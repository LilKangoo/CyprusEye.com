BEGIN;

SET LOCAL statement_timeout='5min';
SET LOCAL lock_timeout='10s';

DO $pre_114490$
DECLARE
  v_chain_sha text;
  v_bridge_sha text;
BEGIN

  IF (
    SELECT count(*)
    FROM supabase_migrations.schema_migrations
    WHERE version='20260811448900'
  )<>1 THEN

    RAISE EXCEPTION
      'hotels_114490_predecessor_migration_missing';

  END IF;


  IF pg_catalog.to_regnamespace(
       'hotels_post_114489_private'
     ) IS NOT NULL
     OR pg_catalog.to_regprocedure(
       'public.hotel_v2_admin_get_capability_lifecycle_114490()'
     ) IS NOT NULL
  THEN

    RAISE EXCEPTION
      'hotels_114490_successor_already_present';

  END IF;


  IF NOT EXISTS(
    SELECT 1
    FROM public.hotels
    WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      AND architecture_version='rooms_v2'
      AND is_published=true
      AND booking_mode='request_confirmation'
  )
  OR (
    SELECT count(*)
    FROM hotels_published_architecture_private.conversion_receipt
    WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  )<>1
  OR EXISTS(
    SELECT 1
    FROM hotels_published_architecture_private.property_history
    WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  )
  THEN

    RAISE EXCEPTION
      'hotels_114490_conversion_state_not_exact';

  END IF;


  PERFORM
    hotels_published_architecture_private.assert_receipt_exact();


  IF
    r5k_catalog_proof.payment_catalog_is_exact()
    IS DISTINCT FROM true
  THEN

    RAISE EXCEPTION
      'hotels_114490_payment_catalog_not_exact';

  END IF;


  IF
    r5k_catalog_proof.executor_d848c718a811c87cce08()
    IS DISTINCT FROM true
  THEN

    RAISE EXCEPTION
      'hotels_114490_frozen_calendar_bridge_not_exact';

  END IF;


  SELECT
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          p.prosrc,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
  INTO v_chain_sha
  FROM pg_catalog.pg_proc p
  WHERE p.oid=
    'r5k_catalog_proof.executor_63e67309c0eb62b8fdb1()'
      ::regprocedure;


  IF v_chain_sha IS DISTINCT FROM
    '6434a6186d811c5046fa334a7f9be7e27c53eb9a2e49bcb5cf5e80420e893c2c'
  THEN

    RAISE EXCEPTION
      'hotels_114490_frozen_chain_executor_drift';

  END IF;


  SELECT
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          p.prosrc,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
  INTO v_bridge_sha
  FROM pg_catalog.pg_proc p
  WHERE p.oid=
    'r5k_catalog_proof.executor_d848c718a811c87cce08()'
      ::regprocedure;


  IF v_bridge_sha IS DISTINCT FROM
    '1a7faf0a4161b1a257cdc067d4e7e0e03aac9a8c99ecc00d72ccfaa428c6d27d'
  THEN

    RAISE EXCEPTION
      'hotels_114490_frozen_calendar_bridge_drift';

  END IF;


  IF (
    SELECT pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          pg_catalog.pg_get_functiondef(
            'hotels_lifecycle_private.chain_state()'::regprocedure
          ),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
  ) IS DISTINCT FROM
    'ebf51ccb03f5cc99557c75c652c4ac5df3615a7172dd547cc3fdcf8cb0cb0cd1'
  THEN

    RAISE EXCEPTION
      'hotels_114490_live_chain_state_definition_drift';

  END IF;


  IF (
    SELECT pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          pg_catalog.pg_get_functiondef(
            'public.hotel_v2_external_calendar_control_common(text,uuid,uuid)'::regprocedure
          ),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
  ) IS DISTINCT FROM
    '4c0bcd67563dfcf545549c7bc0be2b810e3938d689be160c0e4f56381852cb40'
  THEN

    RAISE EXCEPTION
      'hotels_114490_live_calendar_control_definition_drift';

  END IF;

END
$pre_114490$;

CREATE SCHEMA hotels_post_114489_private
AUTHORIZATION postgres;

REVOKE ALL
ON SCHEMA hotels_post_114489_private
FROM PUBLIC,anon,authenticated,service_role;


CREATE OR REPLACE FUNCTION hotels_post_114489_private.safe_state_114490()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE s jsonb; flags jsonb;
BEGIN
 s:=r5k_catalog_proof.executor_63e67309c0eb62b8fdb1(); flags:=hotels_lifecycle_private.actual_flags();
 IF (SELECT count(*) FROM public.site_settings)<>1
 OR flags IS DISTINCT FROM ((s->'state')-'public_booking_enabled')
 OR EXISTS(SELECT 1 FROM jsonb_each(flags) e WHERE jsonb_typeof(e.value)<>'boolean')
 THEN RAISE EXCEPTION 'hotels_lifecycle_flag_state_drift'; END IF;
 RETURN jsonb_build_object('contract_version','hotels_v2_capability_lifecycle_v1','version',s->'version',
 'feature_flags',flags,'public_booking_enabled',false,'architecture','legacy','expected_public_change',false,'audit_chain_exact',true);
END $function$;


CREATE OR REPLACE FUNCTION hotels_post_114489_private.predecessor_flag_exact_114490(p_flag text, p_actual boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE s jsonb;
BEGIN
 IF p_flag NOT IN ('hotel_rooms_v2_enabled','hotel_stripe_connect_enabled') OR p_actual IS NULL THEN RETURN false; END IF;
 s:=hotels_post_114489_private.safe_state_114490();
 RETURN p_actual IS NOT DISTINCT FROM (s->'feature_flags'->>p_flag)::boolean;
END $function$;


CREATE FUNCTION hotels_post_114489_private.calendar_provider_lineage_bridge_114490()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, pg_temp
AS $$
  SELECT r5k_catalog_proof.executor_d848c718a811c87cce08();
$$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_get_capability_lifecycle_114490()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE s jsonb; stripe_ready boolean;
BEGIN
 PERFORM public.hotel_v2_h2a_require_admin();
 IF auth.uid() IS NULL THEN RAISE EXCEPTION USING errcode='42501',message='hotels_lifecycle_admin_required'; END IF;
 s:=hotels_post_114489_private.safe_state_114490();
 SELECT coalesce((SELECT ready AND contract_version='hotels_standard_connect_server_v1' AND checked_at>statement_timestamp()-interval '15 minutes'
 FROM hotels_lifecycle_private.stripe_readiness ORDER BY checked_at DESC,request_id DESC LIMIT 1),false) INTO stripe_ready;
 RETURN s||jsonb_build_object('capabilities',jsonb_build_array(
  jsonb_build_object('key','rooms','enabled',s->'feature_flags'->'hotel_rooms_v2_enabled','blocked_reasons','[]'::jsonb,'requires_confirmation',true),
  jsonb_build_object('key','external','enabled',s->'feature_flags'->'hotel_external_sync_enabled','blocked_reasons',jsonb_build_array('external_calendar_has_separate_reviewed_source_lifecycle'),'requires_confirmation',true),
  jsonb_build_object('key','stripe','enabled',s->'feature_flags'->'hotel_stripe_connect_enabled','blocked_reasons',CASE WHEN stripe_ready THEN '[]'::jsonb ELSE jsonb_build_array('verified_server_configuration_required') END,'requires_confirmation',true),
  jsonb_build_object('key','instant','enabled',false,'blocked_reasons',jsonb_build_array('instant_booking_contract_not_installed'),'requires_confirmation',true),
  jsonb_build_object('key','public_booking','enabled',false,'blocked_reasons',jsonb_build_array('public_booking_release_contract_not_installed'),'requires_confirmation',true)));
END $function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_get_content_control_114490(p_hotel_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  c_contract constant text:='hotels_v2_admin_b_content_control_v1';
  v_hotel public.hotels%rowtype;
  v_profile public.hotel_property_operational_profiles%rowtype;
  v_profile_exists boolean;
  v_assignment_snapshot jsonb;
  v_lifecycle jsonb;
  v_assignments jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_hotel_id is null then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_invalid_content_control_query';
  end if;
  -- This successor is scoped to the reviewed 7 Kamares lifecycle only.
  if p_hotel_id<>'9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid then
    raise exception using errcode='PT404',message='hotels_v2_admin_b_property_not_found';
  end if;
  select * into v_hotel from public.hotels where id=p_hotel_id;
  if not found then
    raise exception using errcode='PT404',
      message='hotels_v2_admin_b_property_not_found';
  end if;
  -- safe_state verifies the immutable audited decision chain and exact current flags.
  -- No boolean-only inference, predecessor flag substitution, or writer delegation.
  v_lifecycle:=hotels_post_114489_private.safe_state_114490();
  if v_lifecycle->>'contract_version' IS DISTINCT FROM 'hotels_v2_capability_lifecycle_v1'
     or v_lifecycle->'feature_flags' IS DISTINCT FROM
       '{"hotel_rooms_v2_enabled":true,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":true}'::jsonb
     or v_lifecycle->'public_booking_enabled' IS DISTINCT FROM 'false'::jsonb
     or v_lifecycle->'expected_public_change' IS DISTINCT FROM 'false'::jsonb
     or v_lifecycle->'audit_chain_exact' IS DISTINCT FROM 'true'::jsonb
     or v_lifecycle->>'architecture' IS DISTINCT FROM 'legacy' then
    raise exception using errcode='55000',message='hotels_114487_post_stripe_lifecycle_required';
  end if;

  select * into v_profile
  from public.hotel_property_operational_profiles
  where hotel_id=p_hotel_id;
  v_profile_exists:=found;

  v_assignment_snapshot:=public.hotel_v2_admin_get_partner_hotel_permissions(p_hotel_id);
  select coalesce(jsonb_agg(
    assignment.value||jsonb_build_object(
      'staff_scope_count',(
        select count(*)::integer
        from public.partner_user_resources scope_row
        join public.partner_users membership
          on membership.id=scope_row.partner_user_id
        where membership.partner_id=(assignment.value->>'partner_id')::uuid
          and scope_row.resource_type='hotels'
          and scope_row.resource_id=p_hotel_id
      ),
      'staff_scope_ids',coalesce((
        select jsonb_agg(scope_row.id order by scope_row.id)
        from public.partner_user_resources scope_row
        join public.partner_users membership
          on membership.id=scope_row.partner_user_id
        where membership.partner_id=(assignment.value->>'partner_id')::uuid
          and scope_row.resource_type='hotels'
          and scope_row.resource_id=p_hotel_id
      ),'[]'::jsonb),
      'permission_exists',coalesce((assignment.value#>>'{permission,exists}')::boolean,false),
      'permission_will_cascade_on_remove',
        coalesce((assignment.value#>>'{permission,exists}')::boolean,false)
    ) order by assignment.ordinal
  ),'[]'::jsonb) into v_assignments
  from jsonb_array_elements(coalesce(v_assignment_snapshot->'assignments','[]'::jsonb))
    with ordinality assignment(value,ordinal);

  v_assignment_snapshot:=jsonb_set(
    v_assignment_snapshot,'{assignments}',v_assignments,false
  );

  return jsonb_build_object(
    'contract_version',c_contract,
    'hotel_id',v_hotel.id,
    'property_updated_at',v_hotel.updated_at,
    'architecture_version',v_hotel.architecture_version,
    'feature_flags',v_assignment_snapshot->'feature_flags',
    'commercial_owner',(
      select case when partner.id is null then null else jsonb_build_object(
        'partner_id',partner.id,'name',partner.name,'status',partner.status,
        'can_manage_hotels',partner.can_manage_hotels
      ) end
      from (select 1) singleton
      left join public.partners partner on partner.id=v_hotel.owner_partner_id
    ),
    'operational_profile',case when v_profile_exists then jsonb_build_object(
      'exists',true,'version',v_profile.version,'updated_at',v_profile.updated_at,
      'maximum_stay_nights',v_profile.maximum_stay_nights,
      'guest_instructions_i18n',v_profile.guest_instructions_i18n,
      'check_in_instructions_i18n',v_profile.check_in_instructions_i18n,
      'check_out_instructions_i18n',v_profile.check_out_instructions_i18n,
      'internal_operational_notes',v_profile.internal_operational_notes
    ) else jsonb_build_object(
      'exists',false,'version',0,'updated_at',null,
      'maximum_stay_nights',null,
      'guest_instructions_i18n','{}'::jsonb,
      'check_in_instructions_i18n','{}'::jsonb,
      'check_out_instructions_i18n','{}'::jsonb,
      'internal_operational_notes',null
    ) end,
    'assignment_snapshot',v_assignment_snapshot
  );
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_c_pricing_control_snapshot_114490(p_hotel_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  c_control constant text:='hotels_v2_admin_c_pricing_control_v1';
  v_hotel public.hotels%rowtype;
  v_flags jsonb;
  v_property jsonb;
  v_default jsonb;
  v_plans jsonb;
  v_rooms jsonb;
  v_rates jsonb;
  v_schedules jsonb;
  v_rules jsonb;
  v_exact jsonb;
  v_allocations jsonb;
  v_legacy jsonb;
  v_token_source jsonb;
  v_token text;
  v_recent jsonb;
  v_result jsonb;
begin
  select * into v_hotel from public.hotels where id=p_hotel_id;
  if not found then
    raise exception using errcode='PT404',message='hotels_v2_admin_c_property_not_found';
  end if;
  perform public.hotel_v2_admin_c_enforce_graph_limits(p_hotel_id);
  select jsonb_build_object(
    'hotel_rooms_v2_enabled',setting.hotel_rooms_v2_enabled,
    'hotel_external_sync_enabled',setting.hotel_external_sync_enabled,
    'hotel_instant_booking_enabled',setting.hotel_instant_booking_enabled,
    'hotel_stripe_connect_enabled',setting.hotel_stripe_connect_enabled
  ) into v_flags from public.site_settings setting where setting.id=1;
  if v_flags is null then
    raise exception using errcode='55000',message='hotels_v2_admin_c_site_settings_missing';
  end if;

  v_property:=jsonb_build_object(
    'id',v_hotel.id,'updated_at',v_hotel.updated_at,
    'architecture_version',v_hotel.architecture_version,
    'currency',v_hotel.currency,'minimum_stay_nights',v_hotel.minimum_stay_nights,
    'booking_mode',v_hotel.booking_mode,
    'maximum_stay_nights',(select profile.maximum_stay_nights
      from public.hotel_property_operational_profiles profile where profile.hotel_id=v_hotel.id),
    'children_policy',v_hotel.children_policy,
    'minimum_child_age',v_hotel.minimum_child_age
  );

  select jsonb_build_object(
    'id',default_price.id,'hotel_id',default_price.hotel_id,
    'nightly_rate',default_price.nightly_rate,'currency',default_price.currency,
    'is_active',default_price.is_active,'review_status',default_price.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(
      default_price.is_active,default_price.review_status),
    'version',default_price.version,'updated_at',default_price.updated_at,
    'immutable_contract',public.hotel_v2_admin_c_immutable_contract(
      default_price.hotel_id,'property_pricing_default',default_price.id),
    'activation_blockers',to_jsonb(array_remove(array[
      case when default_price.currency<>v_hotel.currency then 'currency_mismatch' end,
      case when default_price.nightly_rate<=0 then 'positive_nightly_rate_required' end,
      case when v_hotel.minimum_stay_nights is null then 'minimum_stay_rule_missing' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(default_price.hotel_id,
        'property_pricing_default',default_price.id) then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) into v_default
  from public.hotel_property_pricing_defaults default_price
  where default_price.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',plan.id,'hotel_id',plan.hotel_id,'code',plan.code,
    'name_i18n',plan.name_i18n,'description_i18n',plan.description_i18n,
    'meal_plan_code',plan.meal_plan_code,'cancellation_policy',plan.cancellation_policy,
    'booking_mode_override',plan.booking_mode_override,
    'price_inclusions',to_jsonb(plan.price_inclusions),'is_active',plan.is_active,
    'review_status',plan.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(plan.is_active,plan.review_status),
    'review_basis',case when public.hotel_v2_admin_c_is_promotion_entity(
      plan.hotel_id,'rate_plan',plan.id) then 'h3_1p_promotion' else 'stored' end,
    'sort_order',plan.sort_order,'version',plan.version,'updated_at',plan.updated_at,
    'immutable_contract',public.hotel_v2_admin_c_immutable_contract(
      plan.hotel_id,'rate_plan',plan.id),
    'activation_blockers',to_jsonb(array_remove(array[
      case when not public.hotel_v2_admin_c_i18n_is_valid(plan.name_i18n,true,240)
        then 'localized_name_incomplete' end,
      case when not public.hotel_v2_admin_c_i18n_is_valid(plan.description_i18n,true,5000,true)
        then 'localized_description_incomplete' end,
      case when not public.hotel_v2_admin_c_cancellation_policy_is_valid(
        plan.cancellation_policy) then 'cancellation_policy_invalid' end,
      case when plan.cancellation_policy->>'type'='requires_review'
        then 'cancellation_policy_requires_review' end,
      case when not exists(select 1 from public.hotel_room_rates linked
        where linked.rate_plan_id=plan.id and linked.review_status='reviewed')
        then 'reviewed_room_rate_required' end,
      case when v_hotel.minimum_stay_nights is null
        then 'minimum_stay_rule_missing' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(
        plan.hotel_id,'rate_plan',plan.id) then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) order by plan.sort_order,plan.code,plan.id),'[]'::jsonb)
  into v_plans from public.hotel_rate_plans plan where plan.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',room_type.id,'hotel_id',room_type.hotel_id,'code',room_type.code,
    'name_i18n',room_type.name_i18n,'status',room_type.status,
    'max_occupancy',room_type.max_occupancy,'capacity_adults',room_type.capacity_adults,
    'capacity_children',room_type.capacity_children,
    'children_policy_override',room_type.children_policy_override,
    'minimum_child_age_override',room_type.minimum_child_age_override,
    'inventory_mode',room_type.inventory_mode,
    'base_inventory_count',room_type.base_inventory_count,
    'active_unit_count',(select count(*) from public.hotel_units unit_row
      where unit_row.room_type_id=room_type.id and unit_row.status='active'),
    'version',room_type.version,
    'updated_at',room_type.updated_at
  ) order by room_type.sort_order,room_type.code,room_type.id),'[]'::jsonb)
  into v_rooms from public.hotel_room_types room_type where room_type.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',rate.id,'hotel_id',rate.hotel_id,'room_type_id',rate.room_type_id,
    'rate_plan_id',rate.rate_plan_id,'pricing_schedule_id',rate.pricing_schedule_id,
    'base_nightly_rate',rate.base_nightly_rate,'currency',rate.currency,
    'external_redirect_url',rate.external_redirect_url,'is_active',rate.is_active,
    'review_status',rate.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(rate.is_active,rate.review_status),
    'review_basis',case when public.hotel_v2_admin_c_is_promotion_entity(
      rate.hotel_id,'room_rate',rate.id) then 'h3_1p_promotion' else 'stored' end,
    'sort_order',rate.sort_order,'version',rate.version,'updated_at',rate.updated_at,
    'pricing_source',case when rate.pricing_schedule_id is not null then 'pricing_schedule'
      when exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
        where tier.room_rate_id=rate.id and tier.is_active) then 'independent_tiers'
      when rate.base_nightly_rate>0 then 'base_nightly_rate'
      when exists(select 1 from public.hotel_property_pricing_defaults default_price
        where default_price.hotel_id=rate.hotel_id and default_price.is_active
          and default_price.review_status='reviewed' and default_price.nightly_rate>0
          and default_price.currency=rate.currency) then 'property_default'
      else 'missing' end,
    'base_nightly_rate_authoritative',rate.base_nightly_rate>0
      and rate.pricing_schedule_id is null and not exists(
      select 1 from public.hotel_room_rate_occupancy_tiers tier
      where tier.room_rate_id=rate.id and tier.is_active),
    'independent_tiers',coalesce((select jsonb_agg(jsonb_build_object(
      'id',tier.id,'hotel_id',tier.hotel_id,'room_rate_id',tier.room_rate_id,
      'guest_count',tier.guest_count,'threshold_nights',tier.threshold_nights,
      'nightly_rate',tier.nightly_rate,'is_active',tier.is_active,
      'source',tier.source,
      'immutable_contract',case when tier.source<>'manual' then jsonb_build_object(
        'locked',true,'contract_version','pricing_source_provenance_v1',
        'reason','nonmanual_source_read_only') else null end,
      'version',tier.version,'updated_at',tier.updated_at
    ) order by tier.guest_count,tier.threshold_nights,tier.id)
      from public.hotel_room_rate_occupancy_tiers tier
      where tier.room_rate_id=rate.id),'[]'::jsonb),
    'independent_tiers_fingerprint',public.hotel_v2_admin_c_room_tiers_fingerprint(rate.id),
    'immutable_contract',public.hotel_v2_admin_c_immutable_contract(
      rate.hotel_id,'room_rate',rate.id),
    'activation_blockers',to_jsonb(array_remove(array[
      case when (select status from public.hotel_room_types where id=rate.room_type_id)<>'active'
        then 'room_type_not_active' end,
      case when coalesce((select room_type.max_occupancy
            from public.hotel_room_types room_type where room_type.id=rate.room_type_id),
          (select room_type.capacity_adults+room_type.capacity_children
            from public.hotel_room_types room_type where room_type.id=rate.room_type_id)) is null
        or coalesce((select room_type.max_occupancy
            from public.hotel_room_types room_type where room_type.id=rate.room_type_id),
          (select room_type.capacity_adults+room_type.capacity_children
            from public.hotel_room_types room_type where room_type.id=rate.room_type_id))<=0
        then 'room_capacity_missing' end,
      case when v_hotel.minimum_stay_nights is null
        then 'minimum_stay_rule_missing' end,
      case when not exists(select 1 from public.hotel_rate_plans plan
        where plan.id=rate.rate_plan_id and plan.is_active and plan.review_status='reviewed')
        then 'rate_plan_not_active' end,
      case when rate.currency<>v_hotel.currency then 'currency_mismatch' end,
      case when coalesce((select plan.booking_mode_override
          from public.hotel_rate_plans plan where plan.id=rate.rate_plan_id),
          v_hotel.booking_mode)='external_redirect' and (
          not public.hotel_v2_admin_c_https_url_is_valid(rate.external_redirect_url))
        then 'external_redirect_url_required' end,
      case when rate.pricing_schedule_id is not null and not exists(
        select 1 from public.hotel_pricing_schedules schedule
        where schedule.id=rate.pricing_schedule_id and schedule.is_active
          and schedule.review_status='reviewed'
          and schedule.application_scope='room_occupancy'
          and schedule.currency=rate.currency) then 'pricing_schedule_not_ready' end,
      case when rate.pricing_schedule_id is not null and exists(
        select 1 from public.hotel_room_rate_occupancy_tiers tier
        where tier.room_rate_id=rate.id and tier.is_active)
        then 'conflicting_independent_tiers' end,
      case when rate.pricing_schedule_id is not null and exists(
        select 1 from public.hotel_pricing_schedules schedule
        where schedule.id=rate.pricing_schedule_id and (
          v_hotel.minimum_stay_nights is null or exists(
            select 1 from generate_series(schedule.minimum_billable_occupancy::integer,
              least(schedule.maximum_party_size,coalesce((select room_type.max_occupancy
                from public.hotel_room_types room_type where room_type.id=rate.room_type_id),
                (select room_type.capacity_adults+room_type.capacity_children
                from public.hotel_room_types room_type where room_type.id=rate.room_type_id)))::integer) guest_count
            where not exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers tier
              where tier.schedule_id=schedule.id and tier.is_active
                and tier.guest_count=guest_count
                and tier.threshold_nights<=v_hotel.minimum_stay_nights))))
        then 'occupancy_los_coverage_incomplete' end,
      case when rate.pricing_schedule_id is not null and exists(
        select 1 from public.hotel_pricing_schedules schedule
        where schedule.id=rate.pricing_schedule_id
          and schedule.minimum_billable_occupancy>coalesce(
            (select room_type.max_occupancy from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id),
            (select room_type.capacity_adults+room_type.capacity_children
              from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id)))
        then 'minimum_billable_occupancy_exceeds_room' end,
      case when rate.pricing_schedule_id is null
        and exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
          where tier.room_rate_id=rate.id and tier.is_active)
        and (v_hotel.minimum_stay_nights is null or exists(
          select 1 from generate_series((select min(tier.guest_count)::integer
              from public.hotel_room_rate_occupancy_tiers tier
              where tier.room_rate_id=rate.id and tier.is_active),
            coalesce((select room_type.max_occupancy from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id),(select room_type.capacity_adults+
              room_type.capacity_children from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id))) guest_count
          where not exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
            where tier.room_rate_id=rate.id and tier.is_active
              and tier.guest_count=guest_count
              and tier.threshold_nights<=v_hotel.minimum_stay_nights)))
        then 'occupancy_los_coverage_incomplete' end,
      case when rate.pricing_schedule_id is null
        and (select min(tier.guest_count) from public.hotel_room_rate_occupancy_tiers tier
          where tier.room_rate_id=rate.id and tier.is_active)>coalesce(
            (select room_type.max_occupancy from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id),
            (select room_type.capacity_adults+room_type.capacity_children
              from public.hotel_room_types room_type
              where room_type.id=rate.room_type_id))
        then 'minimum_billable_occupancy_exceeds_room' end,
      case when rate.pricing_schedule_id is null and rate.base_nightly_rate<=0
        and not exists(select 1 from public.hotel_room_rate_occupancy_tiers tier
          where tier.room_rate_id=rate.id and tier.is_active)
        and not exists(select 1 from public.hotel_property_pricing_defaults default_price
          where default_price.hotel_id=rate.hotel_id and default_price.is_active
            and default_price.review_status='reviewed' and default_price.nightly_rate>0
            and default_price.currency=rate.currency)
        then 'pricing_source_required' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(
        rate.hotel_id,'room_rate',rate.id) then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) order by rate.sort_order,rate.id),'[]'::jsonb)
  into v_rates from public.hotel_room_rates rate where rate.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',schedule.id,'hotel_id',schedule.hotel_id,'code',schedule.code,
    'name_i18n',schedule.name_i18n,'application_scope',schedule.application_scope,
    'currency',schedule.currency,'maximum_party_size',schedule.maximum_party_size,
    'minimum_billable_occupancy',schedule.minimum_billable_occupancy,
    'is_active',schedule.is_active,'review_status',schedule.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(
      schedule.is_active,schedule.review_status),
    'source',schedule.source,'source_reference',
      public.hotel_v2_admin_c_schedule_source_summary(
        schedule.source,schedule.source_reference),
    'sharing_mode',schedule.sharing_mode,'version',schedule.version,
    'updated_at',schedule.updated_at,
    'linked_room_rate_ids',coalesce((select jsonb_agg(rate.id order by rate.id)
      from public.hotel_room_rates rate where rate.pricing_schedule_id=schedule.id),'[]'::jsonb),
    'link_fingerprint',public.hotel_v2_admin_c_schedule_link_fingerprint(schedule.id),
    'tiers',coalesce((select jsonb_agg(jsonb_build_object(
      'id',tier.id,'schedule_id',tier.schedule_id,
      'guest_count',tier.guest_count,'threshold_nights',tier.threshold_nights,
      'nightly_rate',tier.nightly_rate,'is_active',tier.is_active,
      'version',tier.version,'updated_at',tier.updated_at
    ) order by tier.guest_count,tier.threshold_nights,tier.id)
      from public.hotel_pricing_schedule_occupancy_tiers tier
      where tier.schedule_id=schedule.id),'[]'::jsonb),
    'tiers_fingerprint',public.hotel_v2_admin_c_schedule_tiers_fingerprint(schedule.id),
    'immutable_contract',coalesce(public.hotel_v2_admin_c_immutable_contract(
      schedule.hotel_id,'pricing_schedule',schedule.id),case
        when schedule.source<>'manual' then jsonb_build_object(
          'locked',true,'contract_version','pricing_source_provenance_v1',
          'reason','nonmanual_source_read_only') else null end),
    'activation_blockers',to_jsonb(array_remove(array[
      case when not public.hotel_v2_admin_c_i18n_is_valid(schedule.name_i18n,true,240)
        then 'localized_name_incomplete' end,
      case when schedule.application_scope<>'room_occupancy'
        then 'property_party_reference_only' end,
      case when schedule.currency<>v_hotel.currency then 'currency_mismatch' end,
      case when v_hotel.minimum_stay_nights is null
        then 'minimum_stay_rule_missing' end,
      case when not exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers tier
        where tier.schedule_id=schedule.id and tier.is_active) then 'active_tier_required' end,
      case when schedule.sharing_mode='independent' and
        (select count(*) from public.hotel_room_rates rate
         where rate.pricing_schedule_id=schedule.id)>1
        then 'independent_schedule_multiple_links' end,
      case when exists(select 1 from generate_series(
        schedule.minimum_billable_occupancy::integer,schedule.maximum_party_size::integer) guest_count
        where not exists(select 1 from public.hotel_pricing_schedule_occupancy_tiers tier
          where tier.schedule_id=schedule.id and tier.is_active
            and tier.guest_count=guest_count
            and tier.threshold_nights<=v_hotel.minimum_stay_nights))
        then 'occupancy_los_coverage_incomplete' end,
      case when schedule.source<>'manual' then 'nonmanual_source_read_only' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(
        schedule.hotel_id,'pricing_schedule',schedule.id)
        then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) order by schedule.code,schedule.id),'[]'::jsonb)
  into v_schedules from public.hotel_pricing_schedules schedule
  where schedule.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',rule.id,'hotel_id',rate.hotel_id,'room_rate_id',rule.room_rate_id,
    'valid_from',rule.valid_from,'valid_to',rule.valid_to,
    'weekdays',to_jsonb(rule.weekdays),'nightly_rate',rule.nightly_rate,
    'minimum_stay',rule.minimum_stay,'maximum_stay',rule.maximum_stay,
    'closed_to_arrival',rule.closed_to_arrival,
    'closed_to_departure',rule.closed_to_departure,'priority',rule.priority,
    'is_active',rule.is_active,'source',rule.source,'version',rule.version,
    'updated_at',rule.updated_at,'immutable_contract',coalesce(
      public.hotel_v2_admin_c_immutable_contract(rate.hotel_id,'room_rate',rate.id),
      case when rule.source<>'manual' then jsonb_build_object(
        'locked',true,'contract_version','pricing_source_provenance_v1',
        'reason','nonmanual_source_read_only') else null end)
  ) order by rule.valid_from,rule.valid_to,rule.priority desc,rule.id),'[]'::jsonb)
  into v_rules from public.hotel_rate_rules rule
  join public.hotel_room_rates rate on rate.id=rule.room_rate_id
  where rate.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',override_row.id,'hotel_id',override_row.hotel_id,
    'room_rate_id',override_row.room_rate_id,'stay_date',override_row.stay_date,
    'nightly_rate_mode',override_row.nightly_rate_mode,
    'nightly_rate',override_row.nightly_rate,
    'minimum_stay_mode',override_row.minimum_stay_mode,
    'minimum_stay',override_row.minimum_stay,
    'maximum_stay_mode',override_row.maximum_stay_mode,
    'maximum_stay',override_row.maximum_stay,
    'pricing_active',((override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null) and case
        when override_row.pricing_source is null then override_row.is_active
          and (override_row.expires_at is null
            or override_row.expires_at>statement_timestamp())
        else override_row.pricing_expires_at is null
          or override_row.pricing_expires_at>statement_timestamp() end),
    'pricing_source',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.source else override_row.pricing_source end,
    'pricing_reason',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then case when override_row.reason=btrim(override_row.reason)
          and length(override_row.reason) between 1 and 500
          and override_row.reason!~'[[:cntrl:]]' then override_row.reason
        else 'Legacy pricing override (read-only; original reason retained server-side)' end
      else override_row.pricing_reason end,
    'pricing_expires_at',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.expires_at else override_row.pricing_expires_at end,
    'pricing_actor_type',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.actor_type else override_row.pricing_actor_type end,
    'pricing_actor_id',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.actor_id else override_row.pricing_actor_id end,
    'pricing_updated_at',case when override_row.pricing_source is null and (
      override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null)
      then override_row.updated_at else override_row.pricing_updated_at end,
    'pricing_correlation_id',override_row.pricing_correlation_id,
    'shared_with_calendar',(override_row.closed_mode is not null
      or override_row.closed_to_arrival_mode is not null
      or override_row.closed_to_departure_mode is not null),
    'pricing_configured',(override_row.nightly_rate_mode is not null
      or override_row.minimum_stay_mode is not null
      or override_row.maximum_stay_mode is not null),
    'immutable_contract',coalesce(public.hotel_v2_admin_c_immutable_contract(
      override_row.hotel_id,'exact_date_price',override_row.id),case
        when override_row.pricing_source is null and (
          override_row.nightly_rate_mode is not null
          or override_row.minimum_stay_mode is not null
          or override_row.maximum_stay_mode is not null) then jsonb_build_object(
            'locked',true,'contract_version','pre_admin_c_calendar_pricing_v1',
            'reason','legacy_exact_pricing_read_only')
        when override_row.pricing_source<>'manual' then jsonb_build_object(
          'locked',true,'contract_version','pricing_source_provenance_v1',
          'reason','nonmanual_source_read_only') else null end),
    'version',override_row.version,'updated_at',override_row.updated_at
  ) order by override_row.stay_date,override_row.room_rate_id,override_row.id),'[]'::jsonb)
  into v_exact from public.hotel_calendar_overrides override_row
  where override_row.hotel_id=p_hotel_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',allocation.id,'hotel_id',allocation.hotel_id,'code',allocation.code,
    'allocation_mode',allocation.allocation_mode,
    'min_guest_count',allocation.min_guest_count,
    'max_guest_count',allocation.max_guest_count,
    'is_active',allocation.is_active,'review_status',allocation.review_status,
    'lifecycle_status',public.hotel_v2_admin_c_lifecycle(
      allocation.is_active,allocation.review_status),
    'sort_order',allocation.sort_order,'version',allocation.version,
    'updated_at',allocation.updated_at,
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',item.id,'hotel_id',item.hotel_id,
      'allocation_rule_id',item.allocation_rule_id,'room_type_id',item.room_type_id,
      'units_required',item.units_required,
      'allocated_guest_count',item.allocated_guest_count,
      'pricing_guest_count',item.pricing_guest_count,
      'allocated_guest_counts',to_jsonb(item.allocated_guest_counts),
      'pricing_guest_counts',to_jsonb(item.pricing_guest_counts),
      'sort_order',item.sort_order,'version',item.version
    ) order by item.sort_order,item.id) from public.hotel_room_allocation_rule_items item
      where item.allocation_rule_id=allocation.id),'[]'::jsonb),
    'items_fingerprint',public.hotel_v2_admin_c_allocation_items_fingerprint(allocation.id),
    'immutable_contract',public.hotel_v2_admin_c_immutable_contract(
      allocation.hotel_id,'allocation_rule',allocation.id),
    'activation_blockers',to_jsonb(array_remove(array[
      case when allocation.review_status<>'reviewed'
        then 'allocation_not_reviewed' end,
      case when not exists(select 1 from public.hotel_room_allocation_rule_items item
        where item.allocation_rule_id=allocation.id) then 'allocation_item_required' end,
      case when exists(select 1 from public.hotel_room_allocation_rule_items item
        where item.allocation_rule_id=allocation.id and (
          (allocation.allocation_mode='customer_choice' and (
            item.units_required<>1 or item.allocated_guest_count is not null
            or item.pricing_guest_count is not null
            or item.allocated_guest_counts is not null
            or item.pricing_guest_counts is not null))
          or (allocation.allocation_mode='required_bundle' and (
            item.allocated_guest_count is null or item.pricing_guest_count is null
            or (item.units_required>1 and (item.allocated_guest_counts is null
              or item.pricing_guest_counts is null))))))
        then 'allocation_contract_incomplete' end,
      case when exists(select 1 from public.hotel_room_allocation_rule_items item
        left join public.hotel_room_types room_type on room_type.id=item.room_type_id
        where item.allocation_rule_id=allocation.id and (
          room_type.id is null or room_type.hotel_id<>allocation.hotel_id
          or room_type.status<>'active'
          or coalesce(room_type.max_occupancy,
            room_type.capacity_adults+room_type.capacity_children) is null
          or coalesce(room_type.max_occupancy,
            room_type.capacity_adults+room_type.capacity_children)<=0))
        then 'allocation_room_not_ready' end,
      case when exists(select 1 from public.hotel_room_allocation_rule_items item
        join public.hotel_room_types room_type on room_type.id=item.room_type_id
        where item.allocation_rule_id=allocation.id and (
          (room_type.inventory_mode='pooled'
            and item.units_required>room_type.base_inventory_count)
          or (room_type.inventory_mode='unitized' and item.units_required>(
            select count(*) from public.hotel_units unit_row
            where unit_row.room_type_id=room_type.id and unit_row.status='active'))))
        then 'allocation_inventory_insufficient' end,
      case when exists(select 1 from public.hotel_room_allocation_rule_items item
        join public.hotel_room_types room_type on room_type.id=item.room_type_id
        where item.allocation_rule_id=allocation.id and (
          (allocation.allocation_mode='customer_choice' and coalesce(
            room_type.max_occupancy,room_type.capacity_adults+
              room_type.capacity_children)<allocation.max_guest_count)
          or (allocation.allocation_mode='required_bundle' and (
            item.allocated_guest_count>coalesce(room_type.max_occupancy,
              room_type.capacity_adults+room_type.capacity_children)*item.units_required
            or item.pricing_guest_count>coalesce(room_type.max_occupancy,
              room_type.capacity_adults+room_type.capacity_children)*item.units_required
            or exists(select 1 from unnest(item.allocated_guest_counts) guest_count
              where guest_count>coalesce(room_type.max_occupancy,
                room_type.capacity_adults+room_type.capacity_children))
            or exists(select 1 from unnest(item.pricing_guest_counts) guest_count
              where guest_count>coalesce(room_type.max_occupancy,
                room_type.capacity_adults+room_type.capacity_children))))))
        then 'allocation_capacity_exceeded' end,
      case when allocation.allocation_mode='required_bundle' and (
        allocation.min_guest_count<>allocation.max_guest_count
        or coalesce((select sum(item.allocated_guest_count)
          from public.hotel_room_allocation_rule_items item
          where item.allocation_rule_id=allocation.id),0)<>allocation.min_guest_count
        or coalesce((select sum(item.units_required)
          from public.hotel_room_allocation_rule_items item
          where item.allocation_rule_id=allocation.id),0)<1)
        then 'bundle_guest_total_mismatch' end,
      case when exists(select 1 from public.hotel_room_allocation_rules other
        where other.hotel_id=allocation.hotel_id and other.id<>allocation.id
          and other.is_active and other.review_status='reviewed'
          and allocation.min_guest_count<=other.max_guest_count
          and other.min_guest_count<=allocation.max_guest_count)
        then 'active_allocation_range_overlap' end,
      case when exists(
        select 1 from generate_series(1,greatest(allocation.max_guest_count::integer,
          coalesce((select max(other.max_guest_count)::integer
            from public.hotel_room_allocation_rules other
            where other.hotel_id=allocation.hotel_id and other.id<>allocation.id
              and other.is_active and other.review_status='reviewed'),0))) guest_count
        where (case when guest_count between allocation.min_guest_count
              and allocation.max_guest_count then 1 else 0 end)
          +(select count(*) from public.hotel_room_allocation_rules other
            where other.hotel_id=allocation.hotel_id and other.id<>allocation.id
              and other.is_active and other.review_status='reviewed'
              and guest_count between other.min_guest_count and other.max_guest_count)<>1)
        then 'active_allocation_coverage_gap' end,
      case when public.hotel_v2_admin_c_is_promotion_entity(
        allocation.hotel_id,'allocation_rule',allocation.id)
        then 'h3_1p_contract_immutable' end
    ]::text[],null))
  ) order by allocation.sort_order,allocation.code,allocation.id),'[]'::jsonb)
  into v_allocations from public.hotel_room_allocation_rules allocation
  where allocation.hotel_id=p_hotel_id;

  v_legacy:=jsonb_build_object(
    'architecture_version',v_hotel.architecture_version,
    'legacy_pricing_authoritative',v_hotel.architecture_version IN ('legacy','rooms_v2'),
    'legacy_pricing_rule_count',case when p_hotel_id=
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      then jsonb_array_length(v_hotel.pricing_tiers->'rules') else null end,
    'legacy_pricing_fingerprint',case when p_hotel_id=
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      then md5(v_hotel.pricing_tiers::text) else null end,
    'public_change',false
  );
  v_token_source:=jsonb_build_object(
    'property',jsonb_build_object(
      'id',v_hotel.id,'architecture_version',v_hotel.architecture_version,
      'currency',v_hotel.currency,'minimum_stay_nights',v_hotel.minimum_stay_nights,
      'booking_mode',v_hotel.booking_mode,
      'maximum_stay_nights',v_property->'maximum_stay_nights',
      'children_policy',v_hotel.children_policy,
      'minimum_child_age',v_hotel.minimum_child_age
    ),
    'feature_flags',v_flags,'legacy_safety',v_legacy,
    'property_pricing_default',v_default,
    'rate_plans',v_plans,
    'room_types',coalesce((select jsonb_agg(
      room.value-'name_i18n'-'code'-'version'-'updated_at' order by room.value->>'id')
      from jsonb_array_elements(v_rooms) room(value)),'[]'::jsonb),
    'room_rates',v_rates,'pricing_schedules',v_schedules,
    'rate_rules',coalesce((select jsonb_agg(
      rule.value-'closed_to_arrival'-'closed_to_departure'-'version'-'updated_at'
      order by rule.value->>'id')
      from jsonb_array_elements(v_rules) rule(value)),'[]'::jsonb),
    'exact_date_prices',coalesce((select jsonb_agg(
      exact.value-'pricing_source'-'pricing_reason'-'pricing_actor_type'
        -'pricing_actor_id'-'pricing_updated_at'-'pricing_correlation_id'
        -'shared_with_calendar'-'version'-'updated_at'
      order by exact.value->>'id') from jsonb_array_elements(v_exact) exact(value)
      where (exact.value->>'pricing_configured')::boolean),'[]'::jsonb),
    'allocation_rules',v_allocations
  );
  v_token:=encode(extensions.digest(convert_to(v_token_source::text,'UTF8'),'sha256'),'hex');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',activity.id,'entity_type',activity.entity_type,
    'entity_id',activity.entity_id,'action',activity.action,
    'correlation_id',activity.correlation_id,'actor_type',activity.actor_type,
    'actor_id',activity.actor_id,
    'source',case when activity.source='hotels_v2_admin_c_pricing_control'
      then activity.source else 'historical_pricing_activity' end,
    'created_at',activity.created_at,
    'before_state',case when activity.source='hotels_v2_admin_c_pricing_control'
      then activity.before_state else null end,
    'after_state',case when activity.source='hotels_v2_admin_c_pricing_control'
      then activity.after_state else null end
  ) order by activity.created_at desc,activity.id desc),
    '[]'::jsonb) into v_recent
  from (select id,entity_type,entity_id,action,correlation_id,actor_type,actor_id,
      source,created_at,before_state,after_state
    from public.hotel_activity_log where hotel_id=p_hotel_id
    and entity_type in('property_pricing_default','rate_plan','room_rate','pricing_schedule','occupancy_tier',
      'rate_rule','calendar_override','allocation_rule')
    and action in('create','update','disable','duplicate','delete')
    and actor_type in('admin','partner','sync','system')
    and (actor_id is not null or actor_type in('sync','system'))
    order by created_at desc,id desc limit 100) activity;

  v_result:=jsonb_build_object(
    'contract_version',c_control,'hotel_id',p_hotel_id,
    'property',v_property,'feature_flags',v_flags,'capability_lifecycle',hotels_post_114489_private.safe_state_114490(),'legacy_safety',v_legacy,
    'property_pricing_default',v_default,
    'snapshot_token',v_token,'rate_plans',v_plans,'room_types',v_rooms,
    'room_rates',v_rates,'pricing_schedules',v_schedules,'rate_rules',v_rules,
    'exact_date_prices',v_exact,'allocation_rules',v_allocations,
    'recent_activity',v_recent
  );
  if octet_length(convert_to(v_result::text,'UTF8'))>20971520 then
    raise exception using errcode='54000',
      message='hotels_v2_admin_c_technical_limit_exceeded',
      detail=jsonb_build_object('snapshot_bytes',
        octet_length(convert_to(v_result::text,'UTF8')),
        'limit',20971520)::text;
  end if;
  return v_result;
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_get_pricing_control_114490(p_hotel_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_hotel_id is null then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_hotel_id';
  end if;
  return public.hotel_v2_admin_c_pricing_control_snapshot_114490(p_hotel_id);
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_preview_pricing_quote_114490(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  c_contract constant text:='hotels_v2_admin_c_pricing_preview_v1';
  v_hotel_id uuid; v_plan_id uuid; v_rule_id uuid; v_selected_room_id uuid;
  v_check_in date; v_check_out date; v_adults integer; v_child_ages smallint[];
  v_guest_count integer; v_nights integer; v_control jsonb; v_hotel public.hotels%rowtype;
  v_rule public.hotel_room_allocation_rules%rowtype; v_item record; v_unit integer;
  v_physical smallint; v_pricing smallint; v_rate_id uuid; v_product jsonb;
  v_resolved jsonb; v_allocation jsonb:='[]'::jsonb; v_products jsonb:='[]'::jsonb;
  v_breakdown jsonb:='[]'::jsonb; v_blockers jsonb:='[]'::jsonb;
  v_total numeric(14,2):=0; v_ok boolean:=true; v_policy text; v_min_age smallint;
  v_item_count integer:=0; v_candidate_count integer; v_requestable boolean:=false;
  v_bundle_child_lower integer:=0; v_bundle_child_upper integer:=0;
  v_bundle_demographic_ambiguous boolean:=false;
  v_bundle_demographic_impossible boolean:=false;
  v_bundle_physical_total integer:=0;
  v_unit_child_lower integer; v_unit_child_upper integer; v_unit_child_threshold smallint;
  v_required_child_thresholds smallint[]:='{}'::smallint[];
  v_optional_child_thresholds smallint[]:='{}'::smallint[];
  v_slot integer;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_request is null or jsonb_typeof(p_request)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_request,array[
       'contract_version','hotel_id','snapshot_token','rate_plan_id',
       'allocation_rule_id','selected_room_type_id','check_in','check_out',
       'adults','child_ages'])
     or not (p_request ?& array['contract_version','hotel_id','snapshot_token',
       'rate_plan_id','allocation_rule_id','selected_room_type_id','check_in','check_out',
       'adults','child_ages'])
     or p_request->>'contract_version'<>c_contract
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_request)
     or jsonb_typeof(p_request->'hotel_id')<>'string'
     or jsonb_typeof(p_request->'snapshot_token')<>'string'
     or p_request->>'snapshot_token'!~'^[0-9a-f]{64}$'
     or jsonb_typeof(p_request->'check_in')<>'string'
     or jsonb_typeof(p_request->'check_out')<>'string'
     or not public.hotel_v2_admin_c_date_is_canonical(p_request->>'check_in')
     or not public.hotel_v2_admin_c_date_is_canonical(p_request->>'check_out')
     or jsonb_typeof(p_request->'rate_plan_id') not in('string','null')
     or jsonb_typeof(p_request->'allocation_rule_id') not in('string','null')
     or jsonb_typeof(p_request->'selected_room_type_id') not in('string','null')
     or jsonb_typeof(p_request->'adults')<>'number'
     or p_request->>'adults'!~'^[0-9]+$'
     or jsonb_typeof(p_request->'child_ages')<>'array'
     or jsonb_array_length(p_request->'child_ages')>50
     or exists(select 1 from jsonb_array_elements(p_request->'child_ages') age
       where jsonb_typeof(age)<>'number' or age#>>'{}'!~'^[0-9]+$'
         or (age#>>'{}')::integer not between 0 and 17) then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_preview_request';
  end if;
  begin
    v_hotel_id:=(p_request->>'hotel_id')::uuid;
    v_plan_id:=case when p_request->>'rate_plan_id' is null then null
      else (p_request->>'rate_plan_id')::uuid end;
    v_rule_id:=case when p_request->>'allocation_rule_id' is null then null
      else (p_request->>'allocation_rule_id')::uuid end;
    v_selected_room_id:=case when p_request->>'selected_room_type_id' is null then null
      else (p_request->>'selected_room_type_id')::uuid end;
    v_check_in:=(p_request->>'check_in')::date;
    v_check_out:=(p_request->>'check_out')::date;
    v_adults:=(p_request->>'adults')::integer;
    select coalesce(array_agg((age#>>'{}')::smallint order by ord),'{}'::smallint[])
      into v_child_ages from jsonb_array_elements(p_request->'child_ages')
      with ordinality child(age,ord);
  exception when others then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_preview_identifiers';
  end;
  if to_char(v_check_in,'YYYY-MM-DD')<>p_request->>'check_in'
     or to_char(v_check_out,'YYYY-MM-DD')<>p_request->>'check_out' then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_preview_dates';
  end if;
  v_nights:=v_check_out-v_check_in; v_guest_count:=v_adults+cardinality(v_child_ages);
  if v_adults not between 1 and 50 or v_guest_count>50 or v_nights<1 then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_preview_range';
  end if;
  if v_nights>365 then
    raise exception using errcode='22023',
      message='hotels_v2_admin_c_preview_query_limit_exceeded',
      detail=jsonb_build_object('technical_maximum_nights',365,'requested_nights',v_nights)::text;
  end if;
  v_control:=public.hotel_v2_admin_c_pricing_control_snapshot_114490(v_hotel_id);
  if v_control->>'snapshot_token' is distinct from p_request->>'snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_stale_pricing_snapshot',
      detail=jsonb_build_object('current_snapshot_token',v_control->>'snapshot_token',
        'changed_entities',jsonb_build_array('pricing_graph'))::text;
  end if;
  select * into v_hotel from public.hotels where id=v_hotel_id;
  if v_plan_id is null then
    select count(*)::integer,(array_agg(plan.id order by plan.id))[1]
      into v_candidate_count,v_plan_id
    from public.hotel_rate_plans plan where plan.hotel_id=v_hotel_id
      and plan.is_active and plan.review_status='reviewed';
    if v_candidate_count<>1 then
      v_plan_id:=null; v_ok:=false;
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'rate_plan_required','rate_plan'));
    end if;
  end if;
  if v_plan_id is not null and not exists(select 1 from public.hotel_rate_plans plan
      where plan.id=v_plan_id and plan.hotel_id=v_hotel_id) then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'rate_plan_not_found','rate_plan',v_plan_id));
    v_ok:=false;
  end if;
  if v_rule_id is null then
    select count(*)::integer,(array_agg(rule.id order by rule.id))[1]
      into v_candidate_count,v_rule_id
    from public.hotel_room_allocation_rules rule where rule.hotel_id=v_hotel_id
      and rule.is_active and rule.review_status='reviewed'
      and v_guest_count between rule.min_guest_count and rule.max_guest_count;
    if v_candidate_count<>1 then
      v_rule_id:=null; v_ok:=false;
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'allocation_rule_required','allocation_rule'));
    end if;
  end if;
  if not v_ok then
    return jsonb_build_object('contract_version',c_contract,'hotel_id',v_hotel_id,
      'snapshot_token',v_control->>'snapshot_token','ok',false,'requestable',false,
      'blocking_reasons',v_blockers,'currency',v_hotel.currency,
      'check_in',v_check_in,'check_out',v_check_out,'nights',v_nights,
      'adults',v_adults,'child_ages',to_jsonb(v_child_ages),'guest_count',v_guest_count,
      'allocation','[]'::jsonb,'products','[]'::jsonb,
      'nightly_breakdown','[]'::jsonb,'customer_total',null,
      'pricing_precedence',jsonb_build_array('exact_date_price','seasonal_range_rule',
        'weekday_rule','pricing_schedule_tier','independent_occupancy_tier',
        'room_rate_base_nightly_rate','property_default'),
      'legacy_authoritative',v_hotel.architecture_version='legacy','public_change',false);
  end if;
  select * into v_rule from public.hotel_room_allocation_rules
    where id=v_rule_id and hotel_id=v_hotel_id;
  if not found or v_guest_count not between v_rule.min_guest_count and v_rule.max_guest_count then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'allocation_rule_mismatch','allocation_rule',v_rule_id));
    v_ok:=false;
  elsif v_rule.allocation_mode='customer_choice' and v_selected_room_id is null then
    select count(*)::integer,(array_agg(item.room_type_id order by item.room_type_id))[1]
      into v_candidate_count,v_selected_room_id
      from public.hotel_room_allocation_rule_items item
      where item.allocation_rule_id=v_rule.id;
    if v_candidate_count<>1 then
      v_selected_room_id:=null; v_ok:=false;
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'room_choice_required','allocation_rule',v_rule.id));
    end if;
  elsif v_rule.allocation_mode='required_bundle' and v_selected_room_id is not null then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'room_choice_not_allowed','allocation_rule',v_rule.id));
    v_ok:=false;
  end if;
  if v_rule.id is not null and (not v_rule.is_active or v_rule.review_status<>'reviewed') then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'allocation_rule_inactive_or_unreviewed','allocation_rule',v_rule.id));
  end if;

  if v_ok then
    for v_item in select item.*,room_type.children_policy_override,
        room_type.minimum_child_age_override,room_type.status room_status,
        room_type.capacity_adults,room_type.capacity_children,
        coalesce(room_type.max_occupancy,
          room_type.capacity_adults+room_type.capacity_children) room_capacity
      from public.hotel_room_allocation_rule_items item
      join public.hotel_room_types room_type on room_type.id=item.room_type_id
      where item.allocation_rule_id=v_rule.id
        and (v_rule.allocation_mode='required_bundle' or item.room_type_id=v_selected_room_id)
      order by item.sort_order,item.id
    loop
      v_item_count:=v_item_count+1;
      v_policy:=coalesce(v_item.children_policy_override,v_hotel.children_policy);
      v_min_age:=case when v_item.children_policy_override is not null
        then v_item.minimum_child_age_override else v_hotel.minimum_child_age end;
      if v_rule.allocation_mode='customer_choice' and cardinality(v_child_ages)>0
          and (v_policy is null or v_policy='not_allowed'
          or (v_policy='minimum_age' and (v_min_age is null or exists(
            select 1 from unnest(v_child_ages) age where age<v_min_age)))) then
        v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'child_policy_not_satisfied','room_type',v_item.room_type_id));
        v_ok:=false;
      end if;
      if v_item.room_status<>'active' then
        v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'allocated_room_type_inactive','room_type',v_item.room_type_id));
        v_ok:=false;
      end if;
      if v_item.room_capacity is null or v_item.room_capacity<=0 then
        v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'room_capacity_missing','room_type',v_item.room_type_id));
        v_ok:=false;
      elsif coalesce(v_item.allocated_guest_count,v_guest_count)>
          v_item.room_capacity*v_item.units_required then
        v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'physical_occupancy_exceeds_room','room_type',v_item.room_type_id));
        v_ok:=false;
      end if;
      if v_rule.allocation_mode='customer_choice' and (
          (v_item.capacity_adults is not null and v_adults>v_item.capacity_adults)
          or (v_item.capacity_children is not null
            and cardinality(v_child_ages)>v_item.capacity_children)) then
        v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
          'room_demographic_capacity_exceeded','room_type',v_item.room_type_id,
          null,jsonb_build_object('adults',v_adults,'children',cardinality(v_child_ages),
            'capacity_adults',v_item.capacity_adults,
            'capacity_children',v_item.capacity_children)));
        v_ok:=false;
      end if;
      v_allocation:=v_allocation||jsonb_build_array(jsonb_build_object(
        'allocation_rule_id',v_rule.id,'allocation_mode',v_rule.allocation_mode,
        'room_type_id',v_item.room_type_id,
        'units_required',v_item.units_required,
        'allocated_guest_count',case when v_rule.allocation_mode='customer_choice'
          then v_guest_count else v_item.allocated_guest_count end,
        'pricing_guest_count',case when v_rule.allocation_mode='customer_choice'
          then v_guest_count else v_item.pricing_guest_count end,
        'allocated_guest_counts',case when v_rule.allocation_mode='customer_choice'
          then to_jsonb(array[v_guest_count]) else to_jsonb(coalesce(
            v_item.allocated_guest_counts,array[v_item.allocated_guest_count])) end,
        'pricing_guest_counts',case when v_rule.allocation_mode='customer_choice'
          then to_jsonb(array[v_guest_count]) else to_jsonb(coalesce(
            v_item.pricing_guest_counts,array[v_item.pricing_guest_count])) end
      ));
      for v_unit in 1..v_item.units_required loop
        v_physical:=case when v_rule.allocation_mode='customer_choice' then v_guest_count
          when v_item.allocated_guest_counts is null then v_item.allocated_guest_count
          else v_item.allocated_guest_counts[v_unit] end;
        v_pricing:=case when v_rule.allocation_mode='customer_choice' then v_guest_count
          when v_item.pricing_guest_counts is null then v_item.pricing_guest_count
          else v_item.pricing_guest_counts[v_unit] end;
        if v_physical is null or v_pricing is null then
          v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
            'allocation_unit_occupancy_missing','allocation_rule',v_rule.id));
          v_ok:=false; continue;
        end if;
        if v_rule.allocation_mode='required_bundle' then
          v_bundle_physical_total:=v_bundle_physical_total+v_physical;
          if v_policy is null or (v_policy='minimum_age' and v_min_age is null) then
            v_bundle_demographic_ambiguous:=true;
          else
            if v_item.capacity_adults is null and v_item.capacity_children is null then
              v_unit_child_lower:=0; v_unit_child_upper:=v_physical;
            elsif v_item.capacity_adults is null or v_item.capacity_children is null then
              v_bundle_demographic_ambiguous:=true;
              v_unit_child_lower:=0; v_unit_child_upper:=0;
            else
              v_unit_child_lower:=greatest(0,v_physical-v_item.capacity_adults);
              v_unit_child_upper:=least(v_physical,v_item.capacity_children);
            end if;
            if v_policy='not_allowed' then v_unit_child_upper:=0; end if;
            if v_unit_child_lower>v_unit_child_upper then
              v_bundle_demographic_impossible:=true;
            else
              v_unit_child_threshold:=case when v_policy='minimum_age'
                then v_min_age else 0 end;
              v_bundle_child_lower:=v_bundle_child_lower+v_unit_child_lower;
              v_bundle_child_upper:=v_bundle_child_upper+v_unit_child_upper;
              if v_unit_child_lower>0 then
                for v_slot in 1..v_unit_child_lower loop
                  v_required_child_thresholds:=array_append(
                    v_required_child_thresholds,v_unit_child_threshold);
                end loop;
              end if;
              if v_unit_child_upper>v_unit_child_lower then
                for v_slot in 1..(v_unit_child_upper-v_unit_child_lower) loop
                  v_optional_child_thresholds:=array_append(
                    v_optional_child_thresholds,v_unit_child_threshold);
                end loop;
              end if;
            end if;
          end if;
        end if;
        select count(*)::integer,(array_agg(rate.id order by rate.id))[1]
          into v_candidate_count,v_rate_id
          from public.hotel_room_rates rate
          where rate.hotel_id=v_hotel_id and rate.rate_plan_id=v_plan_id
            and rate.room_type_id=v_item.room_type_id;
        if v_candidate_count=0 then
          v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
            'room_rate_missing','room_type',v_item.room_type_id));
          v_ok:=false; continue;
        elsif v_candidate_count<>1 then
          v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
            'room_rate_ambiguous','room_type',v_item.room_type_id,null,
            jsonb_build_object('candidate_count',v_candidate_count)));
          v_ok:=false; continue;
        end if;
        v_resolved:=public.hotel_v2_admin_c_resolve_price_product(
          v_rate_id,v_check_in,v_check_out,v_pricing);
        if not coalesce((v_resolved->>'ok')::boolean,false) then v_ok:=false; end if;
        v_blockers:=v_blockers||coalesce(v_resolved->'blocking_reasons','[]'::jsonb);
        if v_resolved->'total' is not null then v_total:=v_total+(v_resolved->>'total')::numeric; end if;
        v_product:=jsonb_build_object('room_type_id',v_item.room_type_id,
          'room_rate_id',v_rate_id,'rate_plan_id',v_plan_id,'unit_sequence',v_unit,
          'allocated_guest_count',v_physical,
          'requested_pricing_guest_count',v_pricing,
          'resolved_pricing_guest_count',v_resolved->'resolved_pricing_guest_count',
          'minimum_billable_occupancy',v_resolved->'minimum_billable_occupancy',
          'base_pricing_source',v_resolved->>'base_pricing_source',
          'base_pricing_source_id',v_resolved->'base_pricing_source_id',
          'los_threshold_nights',v_resolved->'los_threshold_nights',
          'subtotal',v_resolved->'total','currency',v_resolved->>'currency',
          'booking_mode',v_resolved->>'booking_mode',
          'cancellation_policy',v_resolved->'cancellation_policy',
          'price_inclusions',v_resolved->'price_inclusions',
          'effective_minimum_stay',v_resolved->'effective_minimum_stay',
          'effective_maximum_stay',v_resolved->'effective_maximum_stay',
          'stay_allowed',v_resolved->'stay_allowed');
        v_products:=v_products||jsonb_build_array(v_product);
        select coalesce(jsonb_agg(day.value||jsonb_build_object(
          'room_type_id',v_item.room_type_id,'rate_plan_id',v_plan_id,
          'unit_sequence',v_unit,'allocated_guest_count',v_physical)
          order by day.value->>'stay_date'),'[]'::jsonb)
        into v_resolved from jsonb_array_elements(
          coalesce(v_resolved->'nightly_breakdown','[]'::jsonb)) day(value);
        v_breakdown:=v_breakdown||v_resolved;
      end loop;
    end loop;
  end if;
  if v_rule.id is not null and v_rule.allocation_mode='required_bundle' then
    if v_bundle_physical_total<>v_guest_count then
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'bundle_physical_guest_total_mismatch','allocation_rule',v_rule.id,null,
        jsonb_build_object('allocated_guests',v_bundle_physical_total,
          'requested_guests',v_guest_count)));
      v_ok:=false;
    elsif v_bundle_demographic_ambiguous then
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'bundle_demographic_capacity_incomplete','allocation_rule',v_rule.id));
      v_ok:=false;
    elsif v_bundle_demographic_impossible or not
        public.hotel_v2_admin_c_child_slots_are_feasible(v_child_ages,
        v_required_child_thresholds,v_optional_child_thresholds) then
      v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
        'bundle_demographic_capacity_exceeded','allocation_rule',v_rule.id,null,
        jsonb_build_object('children',cardinality(v_child_ages),
          'minimum_children',v_bundle_child_lower,
          'maximum_children',v_bundle_child_upper)));
      v_ok:=false;
    end if;
  end if;
  if v_ok and v_item_count=0 then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'allocation_items_missing','allocation_rule',v_rule.id));
    v_ok:=false;
  end if;
  if not exists(select 1 from public.hotel_rate_plans
      where id=v_plan_id and hotel_id=v_hotel_id) then
    v_blockers:=v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      'rate_plan_not_found','rate_plan',v_plan_id));
    v_ok:=false;
  end if;
  -- This is a shadow calculator. Inactive normalized state is calculated for
  -- Review, but is never requestable and never changes the legacy public path.
  return jsonb_build_object('contract_version',c_contract,'hotel_id',v_hotel_id,
    'snapshot_token',v_control->>'snapshot_token','ok',v_ok,'requestable',v_requestable,
    'blocking_reasons',v_blockers||jsonb_build_array(public.hotel_v2_admin_c_blocker(
      case when v_hotel.architecture_version='legacy' then 'legacy_architecture_authoritative'
        else 'public_hotels_v2_off' end,'property',v_hotel.id)),
    'currency',v_hotel.currency,'check_in',v_check_in,'check_out',v_check_out,
    'nights',v_nights,'adults',v_adults,'child_ages',to_jsonb(v_child_ages),
    'guest_count',v_guest_count,'allocation',v_allocation,'products',v_products,
    'nightly_breakdown',v_breakdown,
    'customer_total',case when v_ok then round(v_total,2) else null end,
    'pricing_precedence',jsonb_build_array('exact_date_price','seasonal_range_rule',
      'weekday_rule','pricing_schedule_tier','independent_occupancy_tier',
      'room_rate_base_nightly_rate','property_default'),
    'legacy_authoritative',v_hotel.architecture_version='legacy','public_change',false);
exception when invalid_text_representation or numeric_value_out_of_range
  or datetime_field_overflow then
  raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_preview_value';
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_apply_pricing_control_plan_114490(p_plan jsonb, p_correlation_id uuid, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  c_plan constant text:='hotels_v2_admin_c_pricing_plan_v1';
  c_control constant text:='hotels_v2_admin_c_pricing_control_v1';
  v_actor uuid; v_hotel_id uuid; v_reviewed_at timestamptz;
  v_request_hash text; v_receipt public.hotel_admin_pricing_action_receipts%rowtype;
  v_control jsonb; v_operation jsonb; v_payload jsonb; v_original jsonb;
  v_entity text; v_action text; v_id uuid; v_expected_version bigint;
  v_lifecycle text; v_target_active boolean; v_target_review text;
  v_before jsonb; v_after jsonb; v_activity jsonb:='[]'::jsonb;
  v_changed boolean:=false; v_entity_changed boolean; v_child jsonb;
  v_plan_row public.hotel_rate_plans%rowtype;
  v_rate_row public.hotel_room_rates%rowtype;
  v_schedule public.hotel_pricing_schedules%rowtype;
  v_rule_row public.hotel_rate_rules%rowtype;
  v_override public.hotel_calendar_overrides%rowtype;
  v_allocation public.hotel_room_allocation_rules%rowtype;
  v_child_current jsonb; v_child_target jsonb; v_result jsonb;
  v_inclusions text[]; v_weekdays smallint[]; v_allocated smallint[]; v_pricing smallint[];
  v_clone_operation jsonb; v_relink_operation jsonb; v_clone_source uuid; v_clone_target uuid;
  v_old_schedule uuid; v_new_schedule uuid; v_link_ids jsonb; v_count integer;
begin
  perform public.hotel_v2_h2a_require_admin();
  v_actor:=auth.uid();
  if v_actor is null or not public.hotel_v2_admin_c_uuid_is_canonical(v_actor::text)
     or p_plan is null or jsonb_typeof(p_plan)<>'object'
     or p_correlation_id is null
     or not public.hotel_v2_admin_c_uuid_is_canonical(p_correlation_id::text)
     or p_idempotency_key is null
     or not public.hotel_v2_h2a_keys_allowed(p_plan,array[
       'contract_version','hotel_id','snapshot_token','reviewed_at','operations'])
     or not (p_plan ?& array['contract_version','hotel_id','snapshot_token','reviewed_at','operations'])
     or p_plan->>'contract_version'<>c_plan
     or octet_length(convert_to(p_plan::text,'UTF8'))>5242880
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_plan)
     or not public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(p_plan)
     or jsonb_typeof(p_plan->'hotel_id')<>'string'
     or jsonb_typeof(p_plan->'snapshot_token')<>'string'
     or p_plan->>'snapshot_token'!~'^[0-9a-f]{64}$'
     or jsonb_typeof(p_plan->'reviewed_at')<>'string'
     or not public.hotel_v2_admin_c_timestamptz_is_canonical(
       p_plan->>'reviewed_at')
     or jsonb_typeof(p_plan->'operations')<>'array'
     or jsonb_array_length(p_plan->'operations') not between 1 and 100
     or length(p_idempotency_key) not between 8 and 120
     or p_idempotency_key!~'^[A-Za-z0-9][A-Za-z0-9._:-]*$' then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_pricing_plan';
  end if;
  begin
    v_hotel_id:=(p_plan->>'hotel_id')::uuid;
    v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
  exception when others then
    raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_plan_identifiers';
  end;
  v_request_hash:=encode(extensions.digest(convert_to(jsonb_build_object(
    'plan',p_plan,'correlation_id',p_correlation_id)::text,'UTF8'),'sha256'),'hex');
  -- Serialize both same actor/key replays and global correlation identity
  -- before the first receipt lookup. A concurrent identical request therefore
  -- deterministically replays instead of surfacing a raw unique violation.
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-admin-c-key:'||v_actor::text||':'||p_idempotency_key,0));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-admin-c-correlation:'||p_correlation_id::text,0));
  select * into v_receipt from public.hotel_admin_pricing_action_receipts
    where actor_id=v_actor and idempotency_key=p_idempotency_key for update;
  if found then
    if v_receipt.request_hash<>v_request_hash or v_receipt.correlation_id<>p_correlation_id
       or v_receipt.hotel_id<>v_hotel_id then
      raise exception using errcode='PT409',message='hotels_v2_admin_c_idempotency_conflict';
    end if;
    return jsonb_set(v_receipt.result,'{replayed}','true'::jsonb,true);
  end if;
  if exists(select 1 from public.hotel_admin_pricing_action_receipts
    where correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_activity_log
       where correlation_id=p_correlation_id) then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_correlation_conflict';
  end if;
  -- Freshness is a new-request gate, not a replay gate. An exact retry must
  -- remain deterministic for the lifetime of its immutable receipt.
  if v_reviewed_at<clock_timestamp()-interval '30 minutes'
     or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='hotels_v2_admin_c_pricing_review_expired';
  end if;

  perform 1 from public.site_settings where id=1 for share;
  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id<>1 or
       hotel_rooms_v2_enabled or false
       or hotel_instant_booking_enabled or hotel_stripe_connect_enabled) then
    raise exception using errcode='55000',message='hotels_v2_admin_c_public_activation_guard';
  end if;
  perform 1 from public.hotels where id=v_hotel_id for update;
  if not found then raise exception using errcode='PT404',message='hotels_v2_admin_c_property_not_found'; end if;
  if v_hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
     and exists(select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id=v_hotel_id
         and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review.review_status='reviewed' and review.parity_case_count=70
         and review.parity_mismatch_count=0) then
    raise exception using errcode='55000',
      message='hotels_v2_admin_c_h3_1p_graph_immutable';
  end if;
  perform 1 from public.hotel_room_types where hotel_id=v_hotel_id order by id for share;
  perform 1 from public.hotel_property_pricing_defaults
    where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_rate_plans where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_room_rates where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_pricing_schedules where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_pricing_schedule_occupancy_tiers tier
    where exists(select 1 from public.hotel_pricing_schedules schedule
      where schedule.id=tier.schedule_id and schedule.hotel_id=v_hotel_id) order by tier.id for update;
  perform 1 from public.hotel_room_rate_occupancy_tiers where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_rate_rules rule where exists(select 1 from public.hotel_room_rates rate
    where rate.id=rule.room_rate_id and rate.hotel_id=v_hotel_id) order by rule.id for update;
  perform 1 from public.hotel_calendar_overrides where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_room_allocation_rules where hotel_id=v_hotel_id order by id for update;
  perform 1 from public.hotel_room_allocation_rule_items where hotel_id=v_hotel_id order by id for update;

  if exists(select 1 from jsonb_array_elements(p_plan->'operations') operation
      group by operation.value->>'entity',operation.value->>'id' having count(*)>1) then
    raise exception using errcode='22023',
      message='hotels_v2_admin_c_duplicate_operation_target';
  end if;

  v_control:=public.hotel_v2_admin_c_pricing_control_snapshot_114490(v_hotel_id);
  if v_control->>'snapshot_token' is distinct from p_plan->>'snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_admin_c_stale_pricing_snapshot',
      detail=jsonb_build_object('current_snapshot_token',v_control->>'snapshot_token',
        'changed_entities',jsonb_build_array('pricing_graph'))::text;
  end if;

  set constraints hotel_rate_plans_admin_c_graph_guard,
    hotel_room_rates_admin_c_graph_guard,hotel_pricing_schedules_admin_c_graph_guard,
    hotel_property_pricing_defaults_admin_c_graph_guard,
    hotel_pricing_schedule_tiers_admin_c_graph_guard,hotel_room_rate_tiers_admin_c_graph_guard,
    hotel_rate_rules_admin_c_graph_guard,hotel_calendar_overrides_admin_c_graph_guard,
    hotel_room_allocation_rules_contract_guard,hotel_room_allocation_rule_items_contract_guard,
    hotel_room_allocation_rules_admin_c_extension_guard,
    hotel_room_allocation_items_admin_c_extension_guard deferred;

  -- Bind the only allowed direct schedule A->B transition: one exact clone
  -- followed by one same-product relink in this two-operation transaction.
  for v_operation in select value from jsonb_array_elements(p_plan->'operations') loop
    if v_operation->>'entity'='pricing_schedule' and v_operation->>'action'='clone' then
      if v_clone_operation is not null then
        raise exception using errcode='22023',message='hotels_v2_admin_c_multiple_clone_operations';
      end if;
      v_clone_operation:=v_operation;
    elsif v_operation->>'entity'='room_rate' and v_operation->>'action'='update' then
      begin
        v_old_schedule:=nullif(v_operation#>>'{expected_original,pricing_schedule_id}','')::uuid;
        v_new_schedule:=nullif(v_operation#>>'{payload,pricing_schedule_id}','')::uuid;
      exception when others then
        raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_schedule_link';
      end;
      if v_old_schedule is not null and v_new_schedule is not null
         and v_old_schedule<>v_new_schedule then
        if v_relink_operation is not null then
          raise exception using errcode='22023',message='hotels_v2_admin_c_multiple_relink_operations';
        end if;
        v_relink_operation:=v_operation;
      end if;
    end if;
  end loop;
  if v_relink_operation is not null then
    if v_clone_operation is null or jsonb_array_length(p_plan->'operations')<>2
       or p_plan#>>'{operations,0,entity}'<>'pricing_schedule'
       or p_plan#>>'{operations,0,action}'<>'clone'
       or p_plan#>>'{operations,1,entity}'<>'room_rate'
       or p_plan#>>'{operations,1,action}'<>'update'
       or (v_clone_operation->>'id')::uuid<>(v_relink_operation#>>'{payload,pricing_schedule_id}')::uuid
       or (v_clone_operation#>>'{payload,source_schedule_id}')::uuid<>
          (v_relink_operation#>>'{expected_original,pricing_schedule_id}')::uuid
       or v_clone_operation#>>'{payload,sharing_mode}'<>'independent'
       or v_clone_operation->>'shared_impact_acknowledged'<>'true'
       or v_relink_operation->>'shared_impact_acknowledged'<>'true'
       or v_relink_operation#>>'{payload,lifecycle_status}' not in('draft','inactive') then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_clone_relink_pair';
    end if;
  elsif v_clone_operation is not null and jsonb_array_length(p_plan->'operations')>1 then
    raise exception using errcode='22023',message='hotels_v2_admin_c_clone_must_be_single_or_exact_pair';
  end if;

  for v_operation in select value from jsonb_array_elements(p_plan->'operations') loop
    if jsonb_typeof(v_operation)<>'object'
       or not public.hotel_v2_h2a_keys_allowed(v_operation,array[
         'entity','action','id','expected_version','expected_children_fingerprint',
         'expected_link_fingerprint','expected_linked_room_rate_ids',
         'shared_impact_acknowledged','activation_acknowledged','expected_original','payload'])
       or not (v_operation ?& array['entity','action','id','expected_version',
         'expected_children_fingerprint','expected_link_fingerprint',
         'expected_linked_room_rate_ids','shared_impact_acknowledged',
         'activation_acknowledged','expected_original','payload'])
       or jsonb_typeof(v_operation->'entity')<>'string'
       or jsonb_typeof(v_operation->'action')<>'string'
       or jsonb_typeof(v_operation->'id')<>'string'
       or jsonb_typeof(v_operation->'expected_version')<>'number'
       or v_operation->>'expected_version'!~'^[0-9]+$'
       or jsonb_typeof(v_operation->'expected_children_fingerprint') not in('string','null')
       or jsonb_typeof(v_operation->'expected_link_fingerprint') not in('string','null')
       or (jsonb_typeof(v_operation->'expected_children_fingerprint')='string'
         and v_operation->>'expected_children_fingerprint'!~'^[0-9a-f]{32}$')
       or (jsonb_typeof(v_operation->'expected_link_fingerprint')='string'
         and v_operation->>'expected_link_fingerprint'!~'^[0-9a-f]{32}$')
       or jsonb_typeof(v_operation->'expected_linked_room_rate_ids')<>'array'
       or jsonb_array_length(v_operation->'expected_linked_room_rate_ids')>1000
       or exists(select 1 from jsonb_array_elements(v_operation->'expected_linked_room_rate_ids') link
         where jsonb_typeof(link)<>'string')
       or (select count(*) from jsonb_array_elements_text(
         v_operation->'expected_linked_room_rate_ids'))<>
         (select count(distinct link) from jsonb_array_elements_text(
           v_operation->'expected_linked_room_rate_ids') link)
       or jsonb_typeof(v_operation->'shared_impact_acknowledged')<>'boolean'
       or jsonb_typeof(v_operation->'activation_acknowledged')<>'boolean'
       or jsonb_typeof(v_operation->'expected_original')<>'object'
       or jsonb_typeof(v_operation->'payload')<>'object' then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_operation_envelope';
    end if;
    begin
      v_entity:=v_operation->>'entity'; v_action:=v_operation->>'action';
      v_id:=(v_operation->>'id')::uuid;
      v_expected_version:=(v_operation->>'expected_version')::bigint;
    exception when others then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_operation_identifiers';
    end;
    if v_entity not in('property_pricing_default','rate_plan','room_rate','pricing_schedule','room_rate_tier_set',
         'rate_rule','exact_date_price','allocation_rule')
       or v_action not in('create','update','clone','disable')
       or (v_action='clone' and v_entity<>'pricing_schedule')
       or (v_entity='room_rate_tier_set' and v_action<>'update')
       or (v_action in('create','clone') and v_expected_version<>0)
       or (v_action not in('create','clone') and v_expected_version<1)
       or (v_action='disable' and v_operation->'payload'<>'{}'::jsonb)
       or (v_action in('create','clone')
         and v_operation->'expected_original'<>'{}'::jsonb) then
      raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_operation_contract';
    end if;
    v_payload:=v_operation->'payload'; v_original:=v_operation->'expected_original';
    v_entity_changed:=false;

    v_after:=public.hotel_v2_admin_c_apply_operation(
      v_hotel_id,v_operation,p_correlation_id,v_actor);
    v_entity_changed:=coalesce((v_after->>'changed')::boolean,false);
    if jsonb_typeof(v_after->'activity')='object' then
      v_activity:=v_activity||jsonb_build_array(v_after->'activity');
    end if;
    v_changed:=v_changed or v_entity_changed;
  end loop;

  set constraints hotel_rate_plans_admin_c_graph_guard,
    hotel_room_rates_admin_c_graph_guard,hotel_pricing_schedules_admin_c_graph_guard,
    hotel_property_pricing_defaults_admin_c_graph_guard,
    hotel_pricing_schedule_tiers_admin_c_graph_guard,hotel_room_rate_tiers_admin_c_graph_guard,
    hotel_rate_rules_admin_c_graph_guard,hotel_calendar_overrides_admin_c_graph_guard,
    hotel_room_allocation_rules_contract_guard,hotel_room_allocation_rule_items_contract_guard,
    hotel_room_allocation_rules_admin_c_extension_guard,
    hotel_room_allocation_items_admin_c_extension_guard immediate;

  v_control:=public.hotel_v2_admin_c_pricing_control_snapshot_114490(v_hotel_id);
  v_result:=jsonb_build_object('contract_version',c_plan,'hotel_id',v_hotel_id,
    'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,
    'replayed',false,'changed',v_changed,'activity',v_activity,
    'pricing_control',v_control);
  insert into public.hotel_admin_pricing_action_receipts(
    hotel_id,actor_id,idempotency_key,correlation_id,request_hash,result)
  values(v_hotel_id,v_actor,p_idempotency_key,p_correlation_id,v_request_hash,v_result);
  return v_result;
exception when invalid_text_representation or numeric_value_out_of_range
  or datetime_field_overflow then
  raise exception using errcode='22023',message='hotels_v2_admin_c_invalid_pricing_value';
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_d_snapshot_external_base_114490(p_hotel_id uuid, p_from date, p_to date, p_require_admin boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_as_of timestamptz:=statement_timestamp();
  v_token text; v_result jsonb; v_valid_until timestamptz;
begin
  if p_require_admin then perform public.hotel_v2_h2a_require_admin(); end if;
  if p_hotel_id is null or p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_query';
  end if;
  if not exists(select 1 from public.hotels where id=p_hotel_id) then
    raise exception using errcode='PT404',message='hotels_v2_admin_d_property_not_found';
  end if;
  if (select count(*) from public.site_settings)<>1 or not exists(select 1 from public.site_settings
      where id=1 and hotels_post_114489_private.predecessor_flag_exact_114490('hotel_rooms_v2_enabled',hotel_rooms_v2_enabled) and hotel_external_sync_enabled in(false,true)
        and not hotel_instant_booking_enabled and hotels_post_114489_private.predecessor_flag_exact_114490('hotel_stripe_connect_enabled',hotel_stripe_connect_enabled))
     or (p_hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and not exists(
       select 1 from public.hotels where id=p_hotel_id and architecture_version IN ('legacy','rooms_v2'))) then
    raise exception using errcode='55000',message='hotels_v2_admin_d_public_activation_guard';
  end if;
  if (select count(*) from public.hotel_room_types where hotel_id=p_hotel_id)>1000
     or (select count(*) from public.hotel_room_rates where hotel_id=p_hotel_id)>5000
     or (select count(*) from public.hotel_units unit join public.hotel_room_types room
       on room.id=unit.room_type_id where room.hotel_id=p_hotel_id)>100000
     or (select count(*)*(p_to-p_from+1) from public.hotel_room_types where hotel_id=p_hotel_id)>62000
     or (select count(*)*(p_to-p_from+1) from public.hotel_room_rates where hotel_id=p_hotel_id)>310000
     or (select count(*) from public.hotel_daily_inventory inventory join public.hotel_room_types room
       on room.id=inventory.room_type_id where room.hotel_id=p_hotel_id and inventory.stay_date between p_from and p_to)>62000
     or (select count(*) from public.hotel_unit_calendar_blocks block where block.hotel_id=p_hotel_id
       and block.from_date<=p_to and block.to_date>=p_from)>62000
     or (select count(*) from public.hotel_calendar_overrides exact where exact.hotel_id=p_hotel_id
       and exact.stay_date between p_from and p_to)>310000
     or (select count(*) from public.hotel_rate_rules rule join public.hotel_room_rates rate
       on rate.id=rule.room_rate_id where rate.hotel_id=p_hotel_id
         and rule.valid_from<=p_to and rule.valid_to>=p_from)>310000
     or (select count(*) from public.hotel_booking_room_allocations allocation
       join public.hotel_bookings booking on booking.id=allocation.booking_id where allocation.hotel_id=p_hotel_id
         and (booking.arrival_date<=p_to and booking.departure_date>p_from or exists(
           select 1 from public.hotel_inventory_commitments commitment
           where commitment.booking_allocation_id=allocation.id and commitment.status='active'
             and commitment.stay_date between p_from and p_to)))>10000
     or (select count(*) from public.hotel_bookings booking where booking.hotel_id=p_hotel_id
       and booking.status in('pending','confirmed') and booking.arrival_date<=p_to and booking.departure_date>p_from
       and not exists(select 1 from public.hotel_booking_room_allocations allocation
         where allocation.booking_id=booking.id and allocation.status='active'
           and allocation.booking_updated_at=booking.updated_at))>10000
     or (select count(*) from public.hotel_inventory_holds hold_row where hold_row.hotel_id=p_hotel_id
       and exists(select 1 from public.hotel_inventory_commitments commitment where commitment.hold_id=hold_row.id
         and commitment.stay_date between p_from and p_to))>10000 then
    raise exception using errcode='54000',message='hotels_v2_admin_d_snapshot_technical_limit_exceeded';
  end if;

  select min(expiry) into v_valid_until from(
    select expires_at expiry from public.hotel_daily_inventory inventory
      join public.hotel_room_types room on room.id=inventory.room_type_id
      where room.hotel_id=p_hotel_id and inventory.stay_date between p_from and p_to and expires_at>v_as_of
    union all select expires_at from public.hotel_unit_calendar_blocks
      where hotel_id=p_hotel_id and is_active and expires_at>v_as_of and from_date<=p_to and to_date>=p_from
    union all select expires_at from public.hotel_inventory_holds
      where hotel_id=p_hotel_id and status='active' and expires_at>v_as_of
        and exists(select 1 from public.hotel_inventory_commitments commitment
          where commitment.hold_id=hotel_inventory_holds.id and commitment.stay_date between p_from and p_to)
    union all select case when availability_updated_at is null then
        case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then expires_at end
      else availability_expires_at end
      from public.hotel_calendar_overrides where hotel_id=p_hotel_id and stay_date between p_from and p_to
      and case when availability_updated_at is null then
        (closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null)
          and is_active and expires_at>v_as_of
        else availability_active and availability_expires_at>v_as_of end
  ) expiry_rows;

  select public.hotel_v2_admin_d_hash(jsonb_build_object(
    'hotel',p_hotel_id,'from',p_from,'to',p_to,
    'property',(select jsonb_build_object('architecture_version',architecture_version,'booking_mode',booking_mode,
      'minimum_stay_nights',minimum_stay_nights,'currency',currency,'timezone',timezone) from public.hotels where id=p_hotel_id),
    'operational_profile',(select jsonb_build_object('maximum_stay_nights',maximum_stay_nights) from public.hotel_property_operational_profiles where hotel_id=p_hotel_id),
    'rooms',coalesce((select jsonb_agg(jsonb_build_array(id,status,inventory_mode,base_inventory_count,
      max_occupancy,capacity_adults,capacity_children) order by id) from public.hotel_room_types where hotel_id=p_hotel_id),'[]'),
    'units',coalesce((select jsonb_agg(jsonb_build_array(unit.id,unit.room_type_id,unit.status) order by unit.id) from public.hotel_units unit join public.hotel_room_types room on room.id=unit.room_type_id where room.hotel_id=p_hotel_id),'[]'),
    'inventory',coalesce((select jsonb_agg(jsonb_build_array(inventory.room_type_id,inventory.stay_date,
      inventory.sellable_units,inventory.sellable_units_mode,inventory.closed,inventory.closed_mode,
      inventory.reason,inventory.expires_at,inventory.version) order by inventory.room_type_id,inventory.stay_date)
      from public.hotel_daily_inventory inventory join public.hotel_room_types room on room.id=inventory.room_type_id
      where room.hotel_id=p_hotel_id and inventory.stay_date between p_from and p_to),'[]'),
    'unit_blocks',coalesce((select jsonb_agg(jsonb_build_array(id,version,is_active,expires_at is null or expires_at>v_as_of) order by id) from public.hotel_unit_calendar_blocks where hotel_id=p_hotel_id and from_date<=p_to and to_date>=p_from),'[]'),
    'overrides',coalesce((select jsonb_agg(jsonb_build_array(id,room_rate_id,stay_date,availability_version,
      case when availability_updated_at is null then
        (closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null) and is_active
        else availability_active end,
      case when availability_updated_at is null then
        case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then expires_at end
        else availability_expires_at end,
      closed,closed_mode,closed_to_arrival,closed_to_arrival_mode,closed_to_departure,closed_to_departure_mode)
      order by id) from public.hotel_calendar_overrides where hotel_id=p_hotel_id and stay_date between p_from and p_to),'[]'),
    'room_rates',coalesce((select jsonb_agg(jsonb_build_array(id,room_type_id,rate_plan_id,is_active,review_status) order by id) from public.hotel_room_rates where hotel_id=p_hotel_id),'[]'),
    'daily_rates',coalesce((select jsonb_agg(jsonb_build_array(dr.room_rate_id,dr.stay_date,dr.closed) order by dr.room_rate_id,dr.stay_date) from public.hotel_daily_rates dr join public.hotel_room_rates rate on rate.id=dr.room_rate_id where rate.hotel_id=p_hotel_id and dr.stay_date between p_from and p_to),'[]'),
    'rules',coalesce((select jsonb_agg(jsonb_build_array(rule.id,rule.availability_version,
      rule.valid_from,rule.valid_to,rule.weekdays,rule.priority,rule.is_active,
      rule.closed_to_arrival,rule.closed_to_departure) order by rule.id)
      from public.hotel_rate_rules rule join public.hotel_room_rates rate on rate.id=rule.room_rate_id
      where rate.hotel_id=p_hotel_id and rule.valid_from<=p_to and rule.valid_to>=p_from),'[]'),
    'bookings',coalesce((select jsonb_agg(jsonb_build_array(booking.id,booking.status,booking.updated_at,
      booking.arrival_date,booking.departure_date,booking.num_adults,booking.num_children) order by booking.id)
      from public.hotel_bookings booking where booking.hotel_id=p_hotel_id and
        (booking.arrival_date<=p_to and booking.departure_date>p_from or exists(
          select 1 from public.hotel_booking_room_allocations allocation
          join public.hotel_inventory_commitments commitment on commitment.booking_allocation_id=allocation.id
          where allocation.booking_id=booking.id and allocation.status='active' and commitment.status='active'
            and commitment.stay_date between p_from and p_to))),'[]'),
    'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',allocation.id,'booking_id',allocation.booking_id,
      'version',allocation.version,'status',allocation.status,'booking_status',booking.status,
      'booking_updated_at',allocation.booking_updated_at,'current_booking_updated_at',booking.updated_at,
      'arrival_date',booking.arrival_date,'departure_date',booking.departure_date,
      'room_type_id',allocation.room_type_id,'rate_plan_id',allocation.rate_plan_id,'room_rate_id',allocation.room_rate_id,
      'unit_ids',allocation.unit_ids,'units_required',allocation.units_required,
      'allocated_guest_counts',allocation.allocated_guest_counts,'pricing_guest_counts',allocation.pricing_guest_counts,
      'commitments',coalesce((select jsonb_agg(jsonb_build_array(commitment.room_type_id,commitment.stay_date,
        commitment.unit_id,commitment.units,commitment.status) order by commitment.room_type_id,commitment.stay_date,
        commitment.unit_id nulls first,commitment.units) from public.hotel_inventory_commitments commitment
        where commitment.booking_allocation_id=allocation.id and commitment.status='active'),'[]'::jsonb)) order by allocation.id)
      from public.hotel_booking_room_allocations allocation join public.hotel_bookings booking on booking.id=allocation.booking_id
      where allocation.hotel_id=p_hotel_id and (booking.arrival_date<=p_to and booking.departure_date>p_from or exists(
        select 1 from public.hotel_inventory_commitments commitment where commitment.booking_allocation_id=allocation.id
          and commitment.status='active' and commitment.stay_date between p_from and p_to))),'[]'),
    'holds',coalesce((select jsonb_agg(jsonb_build_array(hold_row.id,hold_row.version,hold_row.status,hold_row.expires_at,
      (select min(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.status='active'),
      (select max(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.status='active')) order by hold_row.id)
      from public.hotel_inventory_holds hold_row where hold_row.hotel_id=p_hotel_id and exists(
        select 1 from public.hotel_inventory_commitments commitment where commitment.hold_id=hold_row.id
          and commitment.stay_date between p_from and p_to)),'[]'),
    'commitments',coalesce((select jsonb_agg(jsonb_build_array(id,version,status) order by id) from public.hotel_inventory_commitments where hotel_id=p_hotel_id and stay_date between p_from and p_to),'[]'),
    'expiry_boundary',v_valid_until
  )) into v_token;

  with room_days as(
    select room.*,day_value::date stay_date
    from public.hotel_room_types room
    cross join generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') day_value
    where room.hotel_id=p_hotel_id
  ), cell_values as(
    select rd.id room_type_id,rd.stay_date,rd.inventory_mode,
      case when rd.inventory_mode='unitized' then
        (select count(*)::integer from public.hotel_units unit where unit.room_type_id=rd.id and unit.status='active')
        else rd.base_inventory_count end physical_capacity,
      inventory.version inventory_version,
      case when inventory.room_type_id is not null and (inventory.expires_at is null or inventory.expires_at>v_as_of)
             and inventory.sellable_units_mode='set' then inventory.sellable_units
        else case when rd.inventory_mode='unitized' then
          (select count(*)::integer from public.hotel_units unit where unit.room_type_id=rd.id and unit.status='active')
          else rd.base_inventory_count end end configured_sellable_units,
      coalesce((select count(distinct block.unit_id)::integer from public.hotel_unit_calendar_blocks block
        join public.hotel_units unit on unit.id=block.unit_id and unit.room_type_id=rd.id and unit.status='active'
        where block.hotel_id=p_hotel_id and block.room_type_id=rd.id and block.is_active and block.blocked
          and (block.expires_at is null or block.expires_at>v_as_of) and rd.stay_date between block.from_date and block.to_date),0) blocked_unit_count,
      coalesce((select jsonb_agg(distinct block.unit_id order by block.unit_id) from public.hotel_unit_calendar_blocks block
        join public.hotel_units unit on unit.id=block.unit_id and unit.room_type_id=rd.id and unit.status='active'
        where block.hotel_id=p_hotel_id and block.room_type_id=rd.id and block.is_active and block.blocked
          and (block.expires_at is null or block.expires_at>v_as_of) and rd.stay_date between block.from_date and block.to_date),'[]') blocked_unit_ids,
      coalesce(inventory.closed_mode='set' and inventory.closed and (inventory.expires_at is null or inventory.expires_at>v_as_of),false) operational_closed,
      false safety_closed,
      coalesce((select sum(commitment.units)::integer from public.hotel_inventory_commitments commitment
        join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
          and hold_row.status='active' and hold_row.expires_at>v_as_of
        where commitment.hotel_id=p_hotel_id and commitment.room_type_id=rd.id and commitment.stay_date=rd.stay_date
          and commitment.status='active'),0) held_units,
      coalesce((select sum(commitment.units)::integer from public.hotel_inventory_commitments commitment
        join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id and allocation.status='active'
        join public.hotel_bookings booking on booking.id=allocation.booking_id and booking.status in('pending','confirmed')
        where commitment.hotel_id=p_hotel_id and commitment.room_type_id=rd.id and commitment.stay_date=rd.stay_date
          and commitment.status='active'),0) booked_units,
      (select min(hold_row.expires_at) from public.hotel_inventory_commitments commitment
        join public.hotel_inventory_holds hold_row on hold_row.id=commitment.hold_id
          and hold_row.status='active' and hold_row.expires_at>v_as_of
        where commitment.hotel_id=p_hotel_id and commitment.room_type_id=rd.id and commitment.stay_date=rd.stay_date
          and commitment.status='active') earliest_hold_expiry
    from room_days rd left join public.hotel_daily_inventory inventory
      on inventory.room_type_id=rd.id and inventory.stay_date=rd.stay_date
  ), cells as(
    select *,held_units+booked_units committed_units,
      greatest(0,least(physical_capacity-case when inventory_mode='unitized' then blocked_unit_count else 0 end,
        configured_sellable_units)-held_units-booked_units) available_units
    from cell_values
  )
  select jsonb_build_object(
    'contract_version','hotels_v2_admin_d_availability_control_v1','hotel_id',p_hotel_id,
    'from',p_from,'to',p_to,'snapshot_token',v_token,'snapshot_as_of',v_as_of,
    'snapshot_valid_until',v_valid_until,
    'property',(select jsonb_build_object('id',property.id,'name_i18n',jsonb_build_object(
      'pl',coalesce(property.title_i18n->>'pl',property.title->>'pl',property.title_i18n->>'en',property.title->>'en',property.slug),
      'en',coalesce(property.title_i18n->>'en',property.title->>'en',property.title_i18n->>'pl',property.title->>'pl',property.slug),
      'he',coalesce(property.title_i18n->>'he',property.title->>'he',property.title_i18n->>'en',property.title->>'en',property.slug)),
      'architecture_version',property.architecture_version,'timezone',property.timezone,
      'currency',property.currency,'booking_mode',property.booking_mode,
      'minimum_stay_nights',property.minimum_stay_nights,
      'maximum_stay_nights',profile.maximum_stay_nights,
      'updated_at',greatest(property.updated_at,coalesce(profile.updated_at,property.updated_at)))
      from public.hotels property left join public.hotel_property_operational_profiles profile on profile.hotel_id=property.id
      where property.id=p_hotel_id),
    'room_types',coalesce((select jsonb_agg(jsonb_build_object('id',room.id,'hotel_id',room.hotel_id,
      'code',room.code,'name_i18n',room.name_i18n,'inventory_mode',room.inventory_mode,
      'base_inventory_count',room.base_inventory_count,'status',room.status,'sort_order',room.sort_order,
      'max_occupancy',room.max_occupancy,'capacity_adults',room.capacity_adults,
      'capacity_children',room.capacity_children,'version',room.version,'updated_at',room.updated_at)
      order by room.sort_order,room.id) from public.hotel_room_types room where room.hotel_id=p_hotel_id),'[]'),
    'room_rates',coalesce((select jsonb_agg(jsonb_build_object('id',rate.id,'hotel_id',rate.hotel_id,
      'room_type_id',rate.room_type_id,'rate_plan_id',rate.rate_plan_id,'is_active',rate.is_active,
      'review_status',rate.review_status,'sort_order',rate.sort_order,'version',rate.version,'updated_at',rate.updated_at)
      order by rate.sort_order,rate.id) from public.hotel_room_rates rate where rate.hotel_id=p_hotel_id),'[]'),
    'units',coalesce((select jsonb_agg(jsonb_build_object('id',unit.id,'room_type_id',unit.room_type_id,
      'code',unit.code,'name_i18n',unit.name_i18n,'status',unit.status,'version',unit.version,
      'updated_at',unit.updated_at) order by unit.room_type_id,unit.id)
      from public.hotel_units unit join public.hotel_room_types room on room.id=unit.room_type_id where room.hotel_id=p_hotel_id),'[]'),
    'cells',coalesce((select jsonb_agg(jsonb_build_object(
      'room_type_id',room_type_id,'stay_date',stay_date,'inventory_mode',inventory_mode,
      'physical_capacity',physical_capacity,'configured_sellable_units',configured_sellable_units,
      'blocked_unit_count',blocked_unit_count,'blocked_unit_ids',blocked_unit_ids,
      'operational_closed',operational_closed,'safety_closed',safety_closed,'held_units',held_units,'booked_units',booked_units,
      'committed_units',committed_units,'available_units',case when operational_closed or safety_closed then 0 else available_units end,
      'requestable',false,
      'blocking_reasons',case when operational_closed then '["operational_closed"]'::jsonb else '[]'::jsonb end ||
        case when safety_closed then '["safety_closed"]'::jsonb else '[]'::jsonb end ||
        case when available_units<=0 then '["inventory_exhausted"]'::jsonb else '[]'::jsonb end || '["public_activation_off"]'::jsonb,
      'earliest_hold_expiry',earliest_hold_expiry,
      'provenance',jsonb_build_object('capacity','room_type_or_active_units','inventory','hotel_daily_inventory','commitments','server_authoritative'),
      'inventory_version',coalesce(inventory_version,0)) order by room_type_id,stay_date) from cells),'[]'),
    'product_cells',coalesce((select jsonb_agg(jsonb_build_object(
      'room_type_id',rate.room_type_id,'room_rate_id',rate.id,'rate_plan_id',rate.rate_plan_id,
      'stay_date',day_value::date,
      'operational_closed',coalesce(exact.closed_mode='set' and exact.closed and
        case when exact.availability_updated_at is null then exact.is_active and (exact.expires_at is null or exact.expires_at>v_as_of)
          else exact.availability_active and (exact.availability_expires_at is null or exact.availability_expires_at>v_as_of) end,false),
      'closed_to_arrival',coalesce(case when exact.closed_to_arrival_mode='set' and
        case when exact.availability_updated_at is null then exact.is_active and (exact.expires_at is null or exact.expires_at>v_as_of)
          else exact.availability_active and (exact.availability_expires_at is null or exact.availability_expires_at>v_as_of) end then exact.closed_to_arrival end,
        (select rule.closed_to_arrival from public.hotel_rate_rules rule where rule.room_rate_id=rate.id and rule.is_active and day_value::date between rule.valid_from and rule.valid_to and extract(isodow from day_value)::smallint=any(rule.weekdays) order by (cardinality(rule.weekdays)=7) desc,rule.priority desc,rule.id limit 1),false),
      'closed_to_departure',coalesce(case when exact.closed_to_departure_mode='set' and
        case when exact.availability_updated_at is null then exact.is_active and (exact.expires_at is null or exact.expires_at>v_as_of)
          else exact.availability_active and (exact.availability_expires_at is null or exact.availability_expires_at>v_as_of) end then exact.closed_to_departure end,
        (select rule.closed_to_departure from public.hotel_rate_rules rule where rule.room_rate_id=rate.id and rule.is_active and day_value::date between rule.valid_from and rule.valid_to and extract(isodow from day_value)::smallint=any(rule.weekdays) order by (cardinality(rule.weekdays)=7) desc,rule.priority desc,rule.id limit 1),false),
      'safety_closed',coalesce(dr.closed,false),'requestable',false,
      'blocking_reasons',case when coalesce(exact.closed_mode='set' and exact.closed and
        case when exact.availability_updated_at is null then exact.is_active and (exact.expires_at is null or exact.expires_at>v_as_of)
          else exact.availability_active and (exact.availability_expires_at is null or exact.availability_expires_at>v_as_of) end,false)
        then '["operational_closed"]'::jsonb else '[]'::jsonb end ||
        case when coalesce(dr.closed,false) then '["safety_closed"]'::jsonb else '[]'::jsonb end ||
        case when not rate.is_active then '["room_rate_inactive"]'::jsonb else '[]'::jsonb end || '["public_activation_off"]'::jsonb,
      'provenance',jsonb_build_object('exact_override_id',exact.id,'daily_rate',dr.room_rate_id is not null,
        'availability_version',exact.availability_version))
      order by rate.id,day_value) from public.hotel_room_rates rate
      cross join generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') day_value
      left join public.hotel_calendar_overrides exact on exact.room_rate_id=rate.id and exact.stay_date=day_value::date
      left join public.hotel_daily_rates dr on dr.room_rate_id=rate.id and dr.stay_date=day_value::date
      where rate.hotel_id=p_hotel_id),'[]'),
    'daily_inventory',coalesce((select jsonb_agg(jsonb_build_object('room_type_id',inventory.room_type_id,
      'stay_date',inventory.stay_date,'sellable_units',inventory.sellable_units,'sellable_units_mode',inventory.sellable_units_mode,
      'closed',inventory.closed,'closed_mode',inventory.closed_mode,'reason',inventory.reason,'expires_at',inventory.expires_at,
      'version',inventory.version,'updated_at',inventory.updated_at) order by inventory.room_type_id,inventory.stay_date)
      from public.hotel_daily_inventory inventory join public.hotel_room_types room on room.id=inventory.room_type_id
      where room.hotel_id=p_hotel_id and inventory.stay_date between p_from and p_to),'[]'),
    'unit_calendar_blocks',coalesce((select jsonb_agg(jsonb_build_object('id',block.id,'hotel_id',block.hotel_id,
      'room_type_id',block.room_type_id,'unit_id',block.unit_id,'from_date',block.from_date,'to_date',block.to_date,
      'blocked',block.blocked,'reason',block.reason,'expires_at',block.expires_at,'is_active',block.is_active,
      'version',block.version,'updated_at',block.updated_at) order by block.from_date,block.id)
      from public.hotel_unit_calendar_blocks block where block.hotel_id=p_hotel_id and block.from_date<=p_to and block.to_date>=p_from),'[]'),
    'operational_overrides',coalesce((select jsonb_agg(jsonb_build_object('id',exact.id,'hotel_id',exact.hotel_id,
      'room_rate_id',exact.room_rate_id,'stay_date',exact.stay_date,'closed',exact.closed,'closed_mode',exact.closed_mode,
      'closed_to_arrival',exact.closed_to_arrival,'closed_to_arrival_mode',exact.closed_to_arrival_mode,
      'closed_to_departure',exact.closed_to_departure,'closed_to_departure_mode',exact.closed_to_departure_mode,
      'availability_reason',case when exact.availability_updated_at is null then
        case when exact.closed_mode is not null or exact.closed_to_arrival_mode is not null or exact.closed_to_departure_mode is not null then exact.reason end
        else exact.availability_reason end,
      'availability_expires_at',case when exact.availability_updated_at is null then
        case when exact.closed_mode is not null or exact.closed_to_arrival_mode is not null or exact.closed_to_departure_mode is not null then exact.expires_at end
        else exact.availability_expires_at end,
      'availability_active',case when exact.availability_updated_at is null then
        (exact.closed_mode is not null or exact.closed_to_arrival_mode is not null or exact.closed_to_departure_mode is not null) and exact.is_active
        else exact.availability_active end,
      'availability_version',exact.availability_version,
      'availability_updated_at',exact.availability_updated_at) order by exact.stay_date,exact.id)
      from public.hotel_calendar_overrides exact where exact.hotel_id=p_hotel_id and exact.stay_date between p_from and p_to
      ),'[]'),
    'rate_rule_operational_restrictions',coalesce((select jsonb_agg(jsonb_build_object('id',rule.id,'room_rate_id',rule.room_rate_id,'valid_from',rule.valid_from,'valid_to',rule.valid_to,'weekdays',rule.weekdays,'closed_to_arrival',rule.closed_to_arrival,'closed_to_departure',rule.closed_to_departure,'availability_version',rule.availability_version,'availability_reason',rule.availability_reason,'availability_actor_id',rule.availability_actor_id,'availability_correlation_id',rule.availability_correlation_id,'availability_updated_at',rule.availability_updated_at) order by rule.id) from public.hotel_rate_rules rule join public.hotel_room_rates rate on rate.id=rule.room_rate_id where rate.hotel_id=p_hotel_id and rule.valid_from<=p_to and rule.valid_to>=p_from),'[]'),
    'booking_allocations',coalesce((select jsonb_agg(jsonb_build_object('id',allocation.id,'booking_id',allocation.booking_id,
      'arrival_date',booking.arrival_date,'departure_date',booking.departure_date,
      'current_booking_updated_at',booking.updated_at,'current_booking_status',booking.status,
      'room_type_id',allocation.room_type_id,'rate_plan_id',allocation.rate_plan_id,'room_rate_id',allocation.room_rate_id,
      'unit_ids',allocation.unit_ids,'units_required',allocation.units_required,'allocated_guest_counts',allocation.allocated_guest_counts,
      'pricing_guest_counts',allocation.pricing_guest_counts,'booking_updated_at',allocation.booking_updated_at,
      'status',allocation.status,'version',allocation.version,'updated_at',allocation.updated_at,
      'active_commitment_from',(select min(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.booking_allocation_id=allocation.id and commitment.status='active'),
      'active_commitment_to',(select max(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.booking_allocation_id=allocation.id and commitment.status='active'),
      'active_commitments',coalesce((select jsonb_agg(jsonb_build_object('room_type_id',commitment.room_type_id,
        'stay_date',commitment.stay_date,'unit_id',commitment.unit_id,'units',commitment.units,'status',commitment.status)
        order by commitment.room_type_id,commitment.stay_date,commitment.unit_id nulls first,commitment.units)
        from public.hotel_inventory_commitments commitment where commitment.booking_allocation_id=allocation.id
          and commitment.status='active'),'[]'::jsonb)) order by allocation.booking_id,allocation.id)
      from public.hotel_booking_room_allocations allocation join public.hotel_bookings booking on booking.id=allocation.booking_id
      where allocation.hotel_id=p_hotel_id and (booking.arrival_date<=p_to and booking.departure_date>p_from or exists(
        select 1 from public.hotel_inventory_commitments commitment where commitment.booking_allocation_id=allocation.id
          and commitment.status='active' and commitment.stay_date between p_from and p_to))),'[]'),
    'holds',coalesce((select jsonb_agg(jsonb_build_object('id',hold_row.id,'status',hold_row.status,
      'expires_at',hold_row.expires_at,'version',hold_row.version,'created_at',hold_row.created_at,'updated_at',hold_row.updated_at,
      'active_commitment_from',(select min(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.status='active'),
      'active_commitment_to',(select max(commitment.stay_date) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.status='active'),
      'commitments',coalesce((select jsonb_agg(jsonb_build_object('room_type_id',commitment.room_type_id,
        'stay_date',commitment.stay_date,'unit_id',commitment.unit_id,'units',commitment.units,'status',commitment.status)
        order by commitment.stay_date,commitment.id) from public.hotel_inventory_commitments commitment
        where commitment.hold_id=hold_row.id and commitment.stay_date between p_from and p_to),'[]'::jsonb))
      order by hold_row.created_at,hold_row.id) from public.hotel_inventory_holds hold_row where hold_row.hotel_id=p_hotel_id
      and exists(select 1 from public.hotel_inventory_commitments commitment where commitment.hold_id=hold_row.id
        and commitment.stay_date between p_from and p_to)),'[]'),
    'unmapped_booking_blockers',coalesce((select jsonb_agg(jsonb_build_object('booking_id',booking.id,'booking_updated_at',booking.updated_at,'arrival_date',booking.arrival_date,'departure_date',booking.departure_date,'num_adults',coalesce(booking.num_adults,1),'num_children',coalesce(booking.num_children,0),'status',booking.status,
      'reason',case when exists(select 1 from public.hotel_booking_room_allocations stale where stale.booking_id=booking.id and stale.status='active') then 'stale_booking_allocation' else 'exact_booking_allocation_required' end) order by booking.arrival_date,booking.id)
      from public.hotel_bookings booking where booking.hotel_id=p_hotel_id and booking.status in('pending','confirmed')
        and booking.arrival_date<=p_to and booking.departure_date>p_from
        and not exists(select 1 from public.hotel_booking_room_allocations allocation
          where allocation.booking_id=booking.id and allocation.status='active'
            and allocation.booking_updated_at=booking.updated_at)),'[]'),
    'recent_activity',coalesce((select jsonb_agg(jsonb_build_object('id',activity.id,'entity_type',activity.entity_type,
      'entity_id',activity.entity_id,'action',activity.action,
      'before_state',case when activity.before_state is null then null else jsonb_build_object('fingerprint',public.hotel_v2_admin_d_hash(activity.before_state),'redacted',true) end,
      'after_state',case when activity.after_state is null then null else jsonb_build_object('fingerprint',public.hotel_v2_admin_d_hash(activity.after_state),'redacted',true) end,
      'actor_type',activity.actor_type,'source',activity.source,
      'correlation_id',activity.correlation_id,'created_at',activity.created_at)
      order by activity.created_at desc,activity.id desc) from(select * from public.hotel_activity_log
      where hotel_id=p_hotel_id and entity_type in('daily_inventory','calendar_override','unit_calendar_block',
        'rate_rule_operational_restriction','booking_allocation','inventory_hold') order by created_at desc,id desc limit 100) activity),'[]'),
    'public_change',false) into v_result;
  if octet_length(convert_to(v_result::text,'UTF8'))>20971520 then
    raise exception using errcode='54000',message='hotels_v2_admin_d_snapshot_technical_limit_exceeded'; end if;
  return v_result;
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_d_snapshot_114490(p_hotel_id uuid, p_from date, p_to date, p_require_admin boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_control jsonb;
  v_cells jsonb;
  v_blocks jsonb;
  v_global_enabled boolean;
begin
  if (select count(*) from public.site_settings)<>1 then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_settings_cardinality';
  end if;
  select setting.hotel_external_sync_enabled into v_global_enabled
    from public.site_settings setting where setting.id=1;

  v_control:=public.hotel_v2_admin_d_snapshot_external_base_114490(
    p_hotel_id,p_from,p_to,p_require_admin);

  -- While Stage 2F has not been explicitly activated the accepted ADMIN-D
  -- snapshot remains byte-for-byte unchanged.
  if not v_global_enabled then return v_control; end if;

  if (select count(*) from hotels_v2_private.hotel_external_calendar_day_blocks block
      join public.hotel_calendar_source_configs source on source.id=block.source_id
      where block.hotel_id=p_hotel_id and block.stay_date between p_from and p_to
        and block.is_active and source.hotel_id=block.hotel_id
        and source.room_type_id=block.room_type_id and public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)
        and source.is_enabled and source.review_status='reviewed')>62000 then
    raise exception using errcode='54000',message='hotels_v2_external_calendar_availability_limit_exceeded';
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(room_type_id,stay_date,units_blocked)
      order by room_type_id,stay_date),'[]'::jsonb)
  into v_blocks
  from (
    select block.room_type_id,block.stay_date,
      least(sum(block.units_blocked)::integer,greatest(0,
        (cell.value->>'physical_capacity')::integer-case
          when cell.value->>'inventory_mode'='unitized'
          then (cell.value->>'blocked_unit_count')::integer else 0 end)) units_blocked
    from hotels_v2_private.hotel_external_calendar_day_blocks block
    join public.hotel_calendar_source_configs source on source.id=block.source_id
    join lateral jsonb_array_elements(v_control->'cells') cell(value)
      on cell.value->>'room_type_id'=block.room_type_id::text
        and cell.value->>'stay_date'=block.stay_date::text
    where block.hotel_id=p_hotel_id and block.stay_date between p_from and p_to
      and block.is_active and source.hotel_id=block.hotel_id
      and source.room_type_id=block.room_type_id and public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)
      and source.is_enabled and source.review_status='reviewed'
    group by block.room_type_id,block.stay_date,cell.value
  ) effective;

  select coalesce(jsonb_agg(
    case when coalesce(blocked.units_blocked,0)=0 then cell.value else
      jsonb_set(jsonb_set(cell.value,'{available_units}',to_jsonb(greatest(0,
        (cell.value->>'available_units')::integer-blocked.units_blocked)),false),
        '{blocking_reasons}',case when (cell.value->>'available_units')::integer-blocked.units_blocked<=0
          and not (cell.value->'blocking_reasons' ? 'inventory_exhausted')
          then (cell.value->'blocking_reasons')||'["inventory_exhausted"]'::jsonb
          else cell.value->'blocking_reasons' end,false)
    end order by cell.value->>'room_type_id',cell.value->>'stay_date'),'[]'::jsonb)
  into v_cells
  from jsonb_array_elements(v_control->'cells') cell(value)
  left join lateral (
    select (item->>2)::integer units_blocked
    from jsonb_array_elements(v_blocks) item
    where item->>0=cell.value->>'room_type_id'
      and item->>1=cell.value->>'stay_date'
  ) blocked on true;

  v_control:=jsonb_set(v_control,'{cells}',v_cells,false);
  v_control:=jsonb_set(v_control,'{snapshot_token}',to_jsonb(public.hotel_v2_admin_d_hash(
    jsonb_build_object('admin_d_snapshot_token',v_control->>'snapshot_token',
      'external_calendar_effective_blocks',v_blocks))),false);
  return v_control;
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_d_current_foundation_snapshot_114490()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  -- Read-only STABLE inputs: one evaluation per invocation/snapshot; never cached across calls.
  v_lifecycle_once_0 constant jsonb:=public.hotel_v2_external_calendar_activation_function_fingerprints();
  v_lifecycle_once_1 constant boolean:=public.hotel_v2_partner_workspace_function_lineage_is_exact();
  v_lifecycle_once_2 constant boolean:=hotels_post_114489_private.calendar_provider_lineage_bridge_114490();
  v_lifecycle_once_3 constant jsonb:=public.hotel_v2_seven_arches_pricing_scoped_lineage();
  v_lifecycle_once_4 constant boolean:=public.hotel_v2_7a_pricing_activation_transaction_is_preserved();
  v_lifecycle_once_5 constant boolean:=public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact();
  v_lifecycle_once_6 constant boolean:=public.hotel_v2_seven_arches_independent_pricing_topology_is_exact();
  v_lifecycle_once_7 constant boolean:=public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact();
  v_lifecycle_once_8 constant boolean:=public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact();
  v_lifecycle_once_9 constant boolean:=public.hotel_v2_external_calendar_provider_sources_are_attributable();
  v_lifecycle_once_10 constant boolean:=hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact();
  v_lifecycle_once_11 constant jsonb:=public.hotel_v2_seven_arches_owner_capabilities();
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_receipt constant uuid:='37500000-0000-4000-8000-000000000001';
  c_correlation constant uuid:='37500000-0000-4000-8000-000000000002';
  c_idempotency constant uuid:='37500000-0000-4000-8000-000000000003';
  c_activity constant uuid:='37500000-0000-4000-8000-000000000004';
  c_outbox constant uuid:='37500000-0000-4000-8000-000000000005';
  -- Must match the audit-only system attribution emitted by the bootstrap.
  c_system_actor constant uuid:='00000000-0000-0000-0000-000000000000';
  v_original public.hotel_admin_availability_foundation_receipts%rowtype;
  v_evolution public.hotel_admin_availability_foundation_evolution_receipts%rowtype;
  v_current jsonb;
  v_stage2_current jsonb;
  v_h3 jsonb;
  v_current_owner_user_ids uuid[];
  v_current_foreign_permissions_fingerprint text;
  v_original_safe boolean:=false;
  v_historical_receipts_safe boolean:=false;
  v_frozen_contracts_safe boolean:=false;
  v_supported_flags_safe boolean:=false;
  v_stage2f_safe boolean:=false;
  v_deployed_foundations_safe boolean:=false;
  v_current_evolution_safe boolean:=false;
  v_stage2_evolution_safe boolean:=false;
  v_evolution_safe boolean:=false;
  v_target_foundation_safe boolean:=false;
  v_assignment_safe boolean:=false;
  v_owner_membership_safe boolean:=false;
  v_permission_safe boolean:=false;
  v_foreign_permissions_safe boolean:=false;
  v_audit_safe boolean:=false;
begin
  select * into v_original from public.hotel_admin_availability_foundation_receipts where id=1;
  select * into v_evolution from public.hotel_admin_availability_foundation_evolution_receipts where id=1;
  v_current:=public.hotel_v2_admin_d_protected_fingerprints();
  v_stage2_current:=public.hotel_v2_external_calendar_protected_fingerprints();
  v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot_inert_core(c_hotel);
  select array_agg(member.user_id order by member.user_id)
    into v_current_owner_user_ids
  from public.partner_users member
  where member.partner_id=v_evolution.partner_id and member.role='owner';
  select md5(coalesce(string_agg(to_jsonb(permission)::text,'|'
      order by permission.assignment_id),''))
    into v_current_foreign_permissions_fingerprint
  from public.hotel_partner_hotel_permissions permission
  where permission.hotel_id<>c_hotel;
  v_original_safe:=(select count(*)=1 from public.hotel_admin_availability_foundation_receipts)
    and v_original.id=1
    and v_original.protected_fingerprint=encode(extensions.digest(
      convert_to(v_original.protected_fingerprints::text,'UTF8'),'sha256'),'hex');
  v_historical_receipts_safe:=v_original_safe
    and (select count(*)=1 from public.hotel_partner_workspace_foundation_receipts)
    and exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprint=encode(extensions.digest(
        convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex'))
    and (select count(*)=1 from hotels_v2_private.hotel_external_calendar_foundation_receipts)
    and exists(select 1 from hotels_v2_private.hotel_external_calendar_foundation_receipts receipt
      where receipt.id=1 and receipt.protected_fingerprint=encode(extensions.digest(
        convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex'))
    and (select count(*)=1 from hotels_v2_private.hotel_external_calendar_activation_receipts)
    and exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1
        and receipt.site_settings_without_external_fingerprint~'^[0-9a-f]{64}$'
        and jsonb_typeof(receipt.compatibility_function_fingerprints)='object'
        and (select count(*)
          from jsonb_object_keys(receipt.compatibility_function_fingerprints))=20
        and receipt.compatibility_function_fingerprints ?& array[
          'public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)',
          'public.hotel_v2_partner_list_assigned_properties(uuid)',
          'public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)',
          'public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)',
          'public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)',
          'public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)',
          'public.hotel_v2_admin_get_content_control(uuid)',
          'public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)',
          'public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)',
          'public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)',
          'public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)',
          'public.hotel_v2_h3_2b_flags_off()',
          'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',
          'public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)',
          'public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)',
          'public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)',
          'public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)',
          'public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)',
          'public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)',
          'public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)'
        ]::text[]
        and not exists(select 1
          from jsonb_each_text(receipt.compatibility_function_fingerprints) entry
          where entry.value!~'^[0-9a-f]{64}$'));
  v_supported_flags_safe:=(select count(*)=1 and bool_and(id=1
      and hotels_post_114489_private.predecessor_flag_exact_114490('hotel_rooms_v2_enabled',hotel_rooms_v2_enabled) and hotel_external_sync_enabled is not null
      and not hotel_instant_booking_enabled and hotels_post_114489_private.predecessor_flag_exact_114490('hotel_stripe_connect_enabled',hotel_stripe_connect_enabled))
      from public.site_settings);
  v_stage2f_safe:=not exists(select 1 from public.site_settings setting
      where setting.id=1 and setting.hotel_external_sync_enabled)
    or exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1 and receipt.compatibility_function_fingerprints=
        jsonb_set(v_lifecycle_once_0,
          array['public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)']::text[],
          receipt.compatibility_function_fingerprints->
            'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',false)
        and v_lifecycle_once_1);
  v_frozen_contracts_safe:=not exists(select 1 from (values
      ('public.hotel_v2_admin_d_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'a6706c4bdad2180e8cb733949a0084f4355068555ad1014cea340f760e19f5f4'),
      ('public.hotel_v2_admin_d_immutable_row()',false,
        array['search_path=pg_catalog']::text[],
        'bf10c8d2393ef28580dc1079c3b07f0985c6676cce1e5792460aedc6c1453bfa'),
      ('public.hotel_v2_h3_2a_permissions_snapshot(uuid)',true,
        array['search_path=pg_catalog, public']::text[],
        '2014812074cb6765a094de77578e54dac8cc1688c41c1569a37c621f304bc3a3'),
      ('public.hotel_v2_h3_2a_jsonb_is_pii_free(jsonb)',true,
        array['search_path=pg_catalog, public']::text[],
        'be3510f53b2c8034ce74433bbec8718f52301c1ee998179c5f1e55aab49d0cfe'),
      ('public.hotel_v2_h3_2a_reject_immutable_change()',false,
        array['search_path=pg_catalog, public']::text[],
        '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c'),
      ('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)',false,
        array['search_path=pg_catalog, public']::text[],
        '2fcbd3faf9deab53d06332141cb76ab383bf5e0d87fb4309478a8fbc431ae339'),
      ('public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()',false,
        array['search_path=pg_catalog, public']::text[],
        '3c784ac8bdb06833cc89f4e327dda62aac43984f15d781eddd990473e6ed3c35'),
      ('public.hotel_v2_h3_2b_hash(jsonb)',false,
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_h3_2b_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        '7ca318d9b7b441fa67b1f67b95100d4feee5cf9e1e336a826cbe7408edac97f2'),
      ('public.hotel_v2_h3_2b_immutable_row()',false,
        array['search_path=pg_catalog']::text[],
        'b461f8218dc31b9d5cce8ea6893593c9ce058a04dd38e5a2271c7aec2654cc3e'),
      ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_external_calendar_protected_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'f432744ec7753928726b3a4d4c999183d6f1f394217aa35182f594cd05b39d49'),
      ('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914')
    ) expected(signature,security_definer,configuration,source_hash)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
      or procedure_row.prosecdef is distinct from expected.security_definer
      or procedure_row.proconfig is distinct from expected.configuration
      or encode(extensions.digest(convert_to(hotels_lifecycle_private.predecessor_source(procedure_row.oid),'UTF8'),'sha256'),'hex')
        <>expected.source_hash
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))
    and exists(select 1 from pg_class relation where relation.oid=
      'public.hotel_admin_availability_foundation_receipts'::regclass
      and relation.relowner='postgres'::regrole and relation.relrowsecurity)
    and exists(select 1 from pg_class relation where relation.oid=
      'public.hotel_partner_workspace_foundation_receipts'::regclass
      and relation.relowner='postgres'::regrole and relation.relrowsecurity)
    and exists(select 1 from pg_class relation where relation.oid=
      'hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass
      and relation.relowner='postgres'::regrole)
    and exists(select 1 from pg_class relation where relation.oid=
      'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
      and relation.relowner='postgres'::regrole)
    and not exists(select 1 from (values
      ('hotel_admin_availability_foundation_immutable',
        'public.hotel_admin_availability_foundation_receipts'::regclass,
        'public.hotel_v2_admin_d_immutable_row()'::regprocedure),
      ('hotel_partner_workspace_foundation_receipts_immutable',
        'public.hotel_partner_workspace_foundation_receipts'::regclass,
        'public.hotel_v2_h3_2b_immutable_row()'::regprocedure),
      ('hotel_external_calendar_foundation_receipt_immutable',
        'hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass,
        'public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure),
      ('hotel_external_calendar_activation_receipt_immutable',
        'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
        'public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure)
     ) expected(trigger_name,relation_oid,function_oid)
     where not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgname=expected.trigger_name
         and trigger_row.tgrelid=expected.relation_oid
         and trigger_row.tgfoid=expected.function_oid
         and not trigger_row.tgisinternal and trigger_row.tgenabled='O'
         and trigger_row.tgtype=27))
    and not exists(select 1 from pg_policy policy where policy.polrelid in(
      'public.hotel_admin_availability_foundation_receipts'::regclass,
      'public.hotel_partner_workspace_foundation_receipts'::regclass))
    and not exists(select 1 from (values
      ('public.hotel_admin_availability_foundation_receipts'::regclass),
      ('public.hotel_partner_workspace_foundation_receipts'::regclass),
      ('hotels_v2_private.hotel_external_calendar_foundation_receipts'::regclass),
      ('hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass),
      ('public.hotel_partner_hotel_permissions'::regclass)
     ) protected(relation_oid)
     cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege(name)
     where has_table_privilege(0::oid,protected.relation_oid,privilege.name)
        or has_table_privilege('anon',protected.relation_oid,privilege.name)
        or has_table_privilege('authenticated',protected.relation_oid,privilege.name)
        or has_table_privilege('service_role',protected.relation_oid,privilege.name))
    and exists(select 1 from hotels_v2_private.hotel_external_calendar_activation_receipts receipt
      where receipt.id=1 and receipt.compatibility_function_fingerprints=
        jsonb_set(v_lifecycle_once_0,
          array['public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)']::text[],
          receipt.compatibility_function_fingerprints->
            'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',false)
        and v_lifecycle_once_1)
    and v_lifecycle_once_2;
  v_deployed_foundations_safe:=v_historical_receipts_safe and v_frozen_contracts_safe
    and v_supported_flags_safe and v_stage2f_safe;
  v_current_evolution_safe:=(select count(*)=1
      from public.hotel_admin_availability_foundation_evolution_receipts)
    and v_evolution.contract_version='hotels_v2_admin_d_foundation_evolution_v2'
    and v_evolution.original_foundation_receipt_id=1
    and v_evolution.original_protected_fingerprint=v_original.protected_fingerprint
    and v_evolution.before_current_protected_fingerprint=encode(extensions.digest(
      convert_to(v_evolution.before_current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
    and v_evolution.current_protected_fingerprint=encode(extensions.digest(
      convert_to(v_evolution.current_protected_fingerprints::text,'UTF8'),'sha256'),'hex')
    and v_lifecycle_once_3 is not null
    and v_lifecycle_once_4
    and v_lifecycle_once_2
    and v_lifecycle_once_5
    and v_lifecycle_once_6
    and v_lifecycle_once_7
    and v_lifecycle_once_8
    and v_lifecycle_once_9
    and v_lifecycle_once_10
    and v_evolution.allowed_fingerprint_keys=array['hotel_partner_hotel_permissions',
      'hotel_partner_action_receipts','hotel_partner_event_outbox','non_admin_d_activity']::text[]
    and (v_evolution.current_protected_fingerprints-v_evolution.allowed_fingerprint_keys)
      is not distinct from
        (v_evolution.before_current_protected_fingerprints-v_evolution.allowed_fingerprint_keys)
    and not exists(select 1 from unnest(v_evolution.allowed_fingerprint_keys) changed(key)
      where v_evolution.current_protected_fingerprints->changed.key is not distinct from
        v_evolution.before_current_protected_fingerprints->changed.key)
    and v_evolution.before_foreign_permissions_fingerprint=
      v_evolution.current_foreign_permissions_fingerprint
    and v_evolution.current_foreign_permissions_fingerprint=
      v_current_foreign_permissions_fingerprint
    and v_evolution.before_permission is not distinct from jsonb_build_object(
      'exists',false,'version',0,'updated_at',null,
      'has_mutation_capability',false,'capabilities',jsonb_build_object(
        'edit_property_content',false,'edit_property_photos',false,
        'edit_room_content',false,'edit_room_photos',false,'create_rooms',false,
        'edit_room_structure',false,'manage_prices',false,'manage_availability',false,
        'process_bookings',false,'request_booking_changes',false,
        'view_payment_status',false,'initiate_stripe_onboarding',false))
    and v_evolution.capabilities is not distinct from
      v_lifecycle_once_11
    and v_evolution.hotel_id=c_hotel and v_evolution.permission_version=1
    and v_evolution.action_receipt_id=c_receipt
    and v_evolution.correlation_id=c_correlation
    and v_evolution.idempotency_key=c_idempotency
    and v_evolution.activity_id=c_activity and v_evolution.outbox_id=c_outbox;
  v_stage2_evolution_safe:=(select count(*)=1
      from public.hotel_admin_availability_foundation_evolution_receipts)
    and v_evolution.contract_version='hotels_v2_admin_d_foundation_evolution_v2'
    and v_evolution.stage2_before_current_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_evolution.stage2_before_current_protected_fingerprints)
    and v_evolution.stage2_current_protected_fingerprint=
      public.hotel_v2_external_calendar_worker_hash(
        v_evolution.stage2_current_protected_fingerprints)
    and v_lifecycle_once_3 is not null
    and v_lifecycle_once_4
    and v_lifecycle_once_2
    and v_lifecycle_once_5
    and v_lifecycle_once_6
    and v_lifecycle_once_7
    and v_lifecycle_once_8
    and v_lifecycle_once_9
    and v_lifecycle_once_10
    and v_evolution.stage2_allowed_fingerprint_keys=array[
      'hotel_partner_hotel_permissions','non_external_calendar_activity',
      'non_external_calendar_partner_receipts']::text[]
    and (v_evolution.stage2_current_protected_fingerprints-
        v_evolution.stage2_allowed_fingerprint_keys) is not distinct from
      (v_evolution.stage2_before_current_protected_fingerprints-
        v_evolution.stage2_allowed_fingerprint_keys)
    and not exists(select 1 from unnest(v_evolution.stage2_allowed_fingerprint_keys) changed(key)
      where v_evolution.stage2_current_protected_fingerprints->changed.key is not distinct from
        v_evolution.stage2_before_current_protected_fingerprints->changed.key);
  v_evolution_safe:=v_current_evolution_safe and v_stage2_evolution_safe;
  v_target_foundation_safe:=exists(select 1 from public.hotels hotel where hotel.id=c_hotel
      and hotel.architecture_version IN ('legacy','rooms_v2')
      and md5(hotel.pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03'
      and jsonb_array_length(hotel.pricing_tiers->'rules')=63)
    and not exists(select 1 from public.hotel_rate_plans
      where hotel_id=c_hotel and is_active)
    and not exists(select 1 from public.hotel_room_rates
      where hotel_id=c_hotel and is_active)
    and not exists(select 1 from public.hotel_pricing_schedules
      where hotel_id=c_hotel and is_active)
    and public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
    and v_h3#>>'{promotion,status}'='reviewed'
    and v_h3#>>'{source,pricing_fingerprint}'='7208ab4ecc0e47abd64d87ca1ac53a03'
    and (v_h3#>>'{source,rule_count}')::integer=63
    and v_h3->>'pricing_occupancy_mapping_fingerprint'='6f6e6c64f0b0d0aa60e3575d4fd4ac1c'
    and v_h3#>>'{parity,fingerprint}'='b3c915266ab060efaba522cf5587fb75'
    and (v_h3#>>'{parity,total_case_count}')::integer=70
    and (v_h3#>>'{parity,total_mismatch_count}')::integer=0
    and (v_h3#>>'{target,room_schedule,tier_count}')::integer=27
    and (v_h3#>>'{source,property_party_preview,tier_count}')::integer=63
    and exists(select 1 from public.hotel_pricing_promotion_reviews review
      where review.hotel_id=c_hotel
        and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
        and review.review_status='reviewed'
        and review.acknowledged_pricing_occupancy_mapping
        and review.source_fingerprint=v_h3#>>'{source,pricing_fingerprint}'
        and review.target_fingerprint=v_h3#>>'{target,target_fingerprint}'
        and review.pricing_occupancy_mapping_fingerprint=
          v_h3->>'pricing_occupancy_mapping_fingerprint'
        and review.parity_fingerprint=v_h3#>>'{parity,fingerprint}'
        and review.parity_case_count=(v_h3#>>'{parity,total_case_count}')::integer
        and review.parity_mismatch_count=(v_h3#>>'{parity,total_mismatch_count}')::integer
        and review.result->>'target_fingerprint'=review.target_fingerprint);
  v_owner_membership_safe:=coalesce(cardinality(v_current_owner_user_ids),0)>=1
    and v_evolution.owner_user_ids is not distinct from v_current_owner_user_ids
    and array_position(v_evolution.owner_user_ids,null) is null
    and cardinality(v_evolution.owner_user_ids)=(select count(distinct owner_id)
      from unnest(v_evolution.owner_user_ids) owner_id)
    and v_evolution.owner_membership_fingerprint=encode(extensions.digest(convert_to(
      jsonb_build_object(
        'contract_version','hotels_v2_seven_arches_owner_membership_v1',
        'hotel_id',v_evolution.hotel_id,'partner_id',v_evolution.partner_id,
        'assignment_id',v_evolution.assignment_id,'role','owner',
        'owner_user_ids',to_jsonb(v_evolution.owner_user_ids)
      )::text,'UTF8'),'sha256'),'hex');
  v_assignment_safe:=(select count(*)=1 from public.partner_resources assignment
      where assignment.resource_type='hotels' and assignment.resource_id=c_hotel)
    and exists(select 1 from public.hotels hotel
      join public.partners partner on partner.id=hotel.owner_partner_id
      join public.partner_resources assignment on assignment.partner_id=partner.id
        and assignment.resource_type='hotels' and assignment.resource_id=hotel.id
      where hotel.id=c_hotel and partner.id=v_evolution.partner_id
        and assignment.id=v_evolution.assignment_id
        and partner.status='active' and partner.can_manage_hotels)
    and v_owner_membership_safe;
  v_permission_safe:=(select count(*)=1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel and permission.assignment_id=v_evolution.assignment_id
        and permission.partner_id=v_evolution.partner_id and permission.version=1
        and permission.created_by is null and permission.updated_by is null
        and permission.has_mutation_capability
        and public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)
          is not distinct from v_evolution.after_permission
        and public.hotel_v2_h3_2a_permissions_snapshot(permission.assignment_id)->'capabilities'
          is not distinct from v_lifecycle_once_11)
    and (select count(*)=1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel)
    and not exists(select 1 from public.hotel_partner_hotel_permissions permission
      where permission.hotel_id=c_hotel and permission.assignment_id<>v_evolution.assignment_id
        and permission.has_mutation_capability);
  v_foreign_permissions_safe:=v_evolution.before_foreign_permissions_fingerprint=
      v_evolution.current_foreign_permissions_fingerprint
    and v_evolution.current_foreign_permissions_fingerprint=
      v_current_foreign_permissions_fingerprint;
  v_audit_safe:=exists(select 1 from public.hotel_activity_log activity
      where activity.id=v_evolution.activity_id and activity.hotel_id=c_hotel
        and activity.entity_type='property' and activity.entity_id=c_hotel
        and activity.action='update' and activity.actor_type='system' and activity.actor_id is null
        and activity.source='hotels_v2_seven_arches_owner_capability_bootstrap'
        and activity.correlation_id=v_evolution.correlation_id
        and activity.before_state=jsonb_build_object(
          'partner_permissions',v_evolution.before_permission,
          'assignment_id',v_evolution.assignment_id,'partner_id',v_evolution.partner_id)
        and activity.after_state=jsonb_build_object(
          'partner_permissions',v_evolution.after_permission,
          'assignment_id',v_evolution.assignment_id,'partner_id',v_evolution.partner_id))
    and exists(select 1 from public.hotel_partner_action_receipts receipt
      where receipt.id=v_evolution.action_receipt_id and receipt.partner_id=v_evolution.partner_id
        and receipt.hotel_id=c_hotel and receipt.actor_user_id=c_system_actor
        and receipt.action='bootstrap_7_arches_owner_capabilities'
        and receipt.idempotency_key=v_evolution.idempotency_key
        and receipt.request_hash=v_evolution.request_hash
        and receipt.correlation_id=v_evolution.correlation_id
        and receipt.result is not distinct from jsonb_build_object(
          'ok',true,
          'contract_version','hotels_v2_seven_arches_owner_capability_bootstrap_v1',
          'source','hotels_v2_seven_arches_owner_capability_bootstrap',
          'hotel_id',c_hotel,'partner_id',v_evolution.partner_id,
          'assignment_id',v_evolution.assignment_id,'changed',true,
          'permission',v_evolution.after_permission,
          'correlation_id',v_evolution.correlation_id,
          'idempotency_key',v_evolution.idempotency_key)
        and receipt.request_hash=encode(extensions.digest(convert_to(jsonb_build_object(
          'contract_version','hotels_v2_seven_arches_owner_capability_bootstrap_v1',
          'actor_type','system',
          'hotel_id',c_hotel,'partner_id',v_evolution.partner_id,
          'assignment_id',v_evolution.assignment_id,
          'owner_user_ids',to_jsonb(v_evolution.owner_user_ids),
          'owner_membership_fingerprint',v_evolution.owner_membership_fingerprint,
          'capabilities',v_evolution.capabilities)::text,'UTF8'),'sha256'),'hex'))
    and exists(select 1 from public.hotel_partner_event_outbox event
      where event.id=v_evolution.outbox_id and event.partner_id=v_evolution.partner_id
        and event.hotel_id=c_hotel and event.aggregate_type='hotel_partner_permissions'
        and event.aggregate_id=v_evolution.assignment_id
        and event.event_type='hotel.partner_permissions.updated'
        and event.dedupe_key='h3_2a:permission:'||v_evolution.action_receipt_id::text
        and event.payload is not distinct from jsonb_build_object(
          'hotel_id',c_hotel,'assignment_id',v_evolution.assignment_id,
          'partner_id',v_evolution.partner_id,'permission_version',1,
          'has_mutation_capability',true,'correlation_id',v_evolution.correlation_id));
  v_target_foundation_safe:=v_target_foundation_safe or (
    v_lifecycle_once_2
    and v_lifecycle_once_5
    and v_lifecycle_once_6
    and v_lifecycle_once_7
    and v_lifecycle_once_8
    and v_lifecycle_once_9
    and v_lifecycle_once_10);
  -- Successor of the sealed v1 preset: exact audited 114416 permission lineage.
  v_permission_safe:=hotels_lineage_private.current_anchor_is_exact();
  return jsonb_build_object(
    'contract_version','hotels_v2_admin_d_current_foundation_v1',
    'original_receipt_intact',v_original_safe,
    'historical_receipts_intact',v_historical_receipts_safe,
    'frozen_contracts_exact',v_frozen_contracts_safe,
    'supported_hotel_flags',v_supported_flags_safe,
    'stage2f_function_compatibility_exact',v_stage2f_safe,
    'deployed_foundations_exact',v_deployed_foundations_safe,
    'stage2_current_protected_fingerprints',v_stage2_current,
    'stage2_current_protected_fingerprint',
      public.hotel_v2_external_calendar_worker_hash(v_stage2_current),
    'evolution_receipt_count',(select count(*) from public.hotel_admin_availability_foundation_evolution_receipts),
    'current_matches_latest',v_current_evolution_safe,
    'stage2_current_matches_latest',v_stage2_evolution_safe,
    'seven_arches_target_foundation_exact',v_target_foundation_safe,
    'seven_arches_owner_count',coalesce(cardinality(v_current_owner_user_ids),0),
    'seven_arches_owner_membership_exact',v_owner_membership_safe,
    'seven_arches_assignment_exact',v_assignment_safe,
    'seven_arches_owner_preset_exact',v_permission_safe,
    'foreign_hotel_permissions_unchanged',v_foreign_permissions_safe,
    'audit_chain_exact',v_audit_safe,
    'safe',v_deployed_foundations_safe and v_evolution_safe and v_target_foundation_safe
      and v_assignment_safe and v_permission_safe and v_foreign_permissions_safe and v_audit_safe
  );
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_d_review_plan_114490(p_draft jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_hotel_id uuid; v_from date; v_to date; v_control jsonb;
  v_intent jsonb; v_entity text; v_action text; v_id uuid; v_payload jsonb;
  v_original jsonb; v_operations jsonb:='[]'::jsonb; v_impacts jsonb:='[]'::jsonb;
  v_operation jsonb; v_plan jsonb; v_fingerprint text; v_changed boolean:=false; v_operation_changed boolean;
  v_booking public.hotel_bookings%rowtype; v_item jsonb; v_guest_sum integer; v_room_capacity integer; v_inventory_mode text;
  v_expected_commitments jsonb;
  v_day date; v_weekdays smallint[]; v_rate_id uuid;
  v_impact_rooms jsonb; v_impact_rates jsonb; v_impact_from date; v_impact_to date;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_draft is null or jsonb_typeof(p_draft)<>'object'
     or not public.hotel_v2_admin_d_keys_allowed(p_draft,array['contract_version','hotel_id','from','to','snapshot_token','intents'])
     or p_draft->>'contract_version'<>'hotels_v2_admin_d_availability_draft_v1'
     or jsonb_typeof(p_draft->'intents')<>'array'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_draft)
     or not public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(p_draft)
     or not public.hotel_v2_admin_d_json_dates_are_canonical(p_draft)
     or octet_length(convert_to(p_draft::text,'UTF8'))>5242880
     or jsonb_array_length(p_draft->'intents')<1 or jsonb_array_length(p_draft->'intents')>100 then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_draft';
  end if;
  begin v_hotel_id:=(p_draft->>'hotel_id')::uuid; v_from:=(p_draft->>'from')::date; v_to:=(p_draft->>'to')::date;
  exception when others then raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_draft'; end;
  if v_to<v_from or v_to-v_from>364 or (v_to-v_from>61 and exists(
    select 1 from jsonb_array_elements(p_draft->'intents') intent(value)
    where intent.value->>'entity' not in('booking_allocation','hold'))) then
    raise exception using errcode='22023',message='hotels_v2_admin_d_plan_range_limit_exceeded'; end if;
  v_control:=public.hotel_v2_admin_d_snapshot_114490(v_hotel_id,v_from,v_to,false);
  if v_control->>'snapshot_token' is distinct from p_draft->>'snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_availability_snapshot';
  end if;

  for v_intent in select value from jsonb_array_elements(p_draft->'intents') loop
    if jsonb_typeof(v_intent)<>'object'
       or not public.hotel_v2_admin_d_keys_allowed(v_intent,array['entity','action','id','payload'])
       or jsonb_typeof(v_intent->'payload')<>'object' then
      raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_intent';
    end if;
    v_entity:=v_intent->>'entity'; v_action:=v_intent->>'action'; v_payload:=v_intent->'payload';
    if (v_payload?'expires_at' and jsonb_typeof(v_payload->'expires_at')<>'null'
          and (v_payload->>'expires_at')::timestamptz<=statement_timestamp())
       or (v_payload?'availability_expires_at' and jsonb_typeof(v_payload->'availability_expires_at')<>'null'
          and (v_payload->>'availability_expires_at')::timestamptz<=statement_timestamp()) then
      raise exception using errcode='22023',message='hotels_v2_admin_d_expiry_must_be_future'; end if;
    v_operation_changed:=false;
    begin v_id:=case when v_intent->>'id' is null then null else (v_intent->>'id')::uuid end;
    exception when others then raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_intent_id'; end;
    v_original:=null;

    if v_entity='operational_override_range' and v_action='expand' then
      if v_id is not null then raise exception using errcode='22023',message='hotels_v2_admin_d_range_id_must_be_null'; end if;
      if not public.hotel_v2_admin_d_keys_allowed(v_payload,array['room_rate_id','valid_from','valid_to','weekdays',
        'closed','closed_mode','closed_to_arrival','closed_to_arrival_mode','closed_to_departure',
        'closed_to_departure_mode','reason','availability_expires_at'])
         or not (v_payload ?& array['room_rate_id','valid_from','valid_to','weekdays','reason'])
         or jsonb_typeof(v_payload->'weekdays')<>'array' then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operational_override_range'; end if;
      v_rate_id:=(v_payload->>'room_rate_id')::uuid;
      if not exists(select 1 from public.hotel_room_rates where id=v_rate_id and hotel_id=v_hotel_id) then
        raise exception using errcode='23503',message='hotels_v2_admin_d_foreign_room_rate'; end if;
      if not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason')
         or exists(select 1 from jsonb_array_elements(v_payload->'weekdays') weekday(value)
           where jsonb_typeof(weekday.value)<>'number' or weekday.value#>>'{}'!~'^[1-7]$') then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operational_override_range'; end if;
      v_weekdays:=array(select value::smallint from jsonb_array_elements_text(v_payload->'weekdays'));
      if (v_payload->>'valid_from')::date<v_from or (v_payload->>'valid_to')::date>v_to
         or (v_payload->>'valid_to')::date<(v_payload->>'valid_from')::date
         or cardinality(v_weekdays) not between 1 and 7 or array_position(v_weekdays,null) is not null
         or exists(select 1 from unnest(v_weekdays) weekday where weekday not between 1 and 7)
         or v_weekdays is distinct from array(select distinct weekday from unnest(v_weekdays) weekday order by weekday)
         or not public.hotel_v2_admin_d_keys_allowed(v_payload,array['room_rate_id','valid_from','valid_to','weekdays',
           'closed','closed_mode','closed_to_arrival','closed_to_arrival_mode','closed_to_departure',
           'closed_to_departure_mode','reason','availability_expires_at'])
         or (v_payload?'closed' and not v_payload?'closed_mode')
         or (v_payload?'closed_to_arrival' and not v_payload?'closed_to_arrival_mode')
         or (v_payload?'closed_to_departure' and not v_payload?'closed_to_departure_mode')
         or (v_payload?'closed_mode' and (v_payload->>'closed_mode' not in('set','clear','no_change')
           or (v_payload->>'closed_mode'='set' and jsonb_typeof(v_payload->'closed')<>'boolean')
           or (v_payload->>'closed_mode'='clear' and jsonb_typeof(v_payload->'closed')<>'null')
           or (v_payload->>'closed_mode'='no_change' and v_payload?'closed')))
         or (v_payload?'closed_to_arrival_mode' and (v_payload->>'closed_to_arrival_mode' not in('set','clear','no_change')
           or (v_payload->>'closed_to_arrival_mode'='set' and jsonb_typeof(v_payload->'closed_to_arrival')<>'boolean')
           or (v_payload->>'closed_to_arrival_mode'='clear' and jsonb_typeof(v_payload->'closed_to_arrival')<>'null')
           or (v_payload->>'closed_to_arrival_mode'='no_change' and v_payload?'closed_to_arrival')))
         or (v_payload?'closed_to_departure_mode' and (v_payload->>'closed_to_departure_mode' not in('set','clear','no_change')
           or (v_payload->>'closed_to_departure_mode'='set' and jsonb_typeof(v_payload->'closed_to_departure')<>'boolean')
           or (v_payload->>'closed_to_departure_mode'='clear' and jsonb_typeof(v_payload->'closed_to_departure')<>'null')
           or (v_payload->>'closed_to_departure_mode'='no_change' and v_payload?'closed_to_departure'))) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operational_override_range'; end if;
      if v_payload->>'closed_mode'='no_change' then v_payload:=v_payload-'closed_mode'-'closed'; end if;
      if v_payload->>'closed_to_arrival_mode'='no_change' then v_payload:=v_payload-'closed_to_arrival_mode'-'closed_to_arrival'; end if;
      if v_payload->>'closed_to_departure_mode'='no_change' then v_payload:=v_payload-'closed_to_departure_mode'-'closed_to_departure'; end if;
      for v_day in select day_value::date from generate_series((v_payload->>'valid_from')::date,
        (v_payload->>'valid_to')::date,interval '1 day') day_value
        where extract(isodow from day_value)::smallint=any(v_weekdays) order by day_value loop
        select id,jsonb_build_object('id',id,'hotel_id',hotel_id,'room_rate_id',room_rate_id,'stay_date',stay_date,
          'closed',closed,'closed_mode',closed_mode,'closed_to_arrival',closed_to_arrival,
          'closed_to_arrival_mode',closed_to_arrival_mode,'closed_to_departure',closed_to_departure,
          'closed_to_departure_mode',closed_to_departure_mode,
          'availability_expires_at',case when availability_updated_at is null then
            case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then expires_at end
            else availability_expires_at end,
          'availability_active',case when availability_updated_at is null then
            (closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null) and is_active
            else availability_active end,
          'availability_version',availability_version)
          into v_id,v_original from public.hotel_calendar_overrides where room_rate_id=v_rate_id and stay_date=v_day;
        v_id:=coalesce(v_id,public.hotel_v2_admin_d_deterministic_uuid(v_rate_id::text||':'||v_day::text||':admin-d'));
        -- An absent or ADMIN-C price-only row is operationally neutral. CLEAR-only
        -- patches preserve that neutral state and must not create D rows/activity.
        v_operation_changed:=(v_original is null and
            (v_payload->>'closed_mode'='set' or v_payload->>'closed_to_arrival_mode'='set'
              or v_payload->>'closed_to_departure_mode'='set'))
          or (v_original is not null
          and (v_original->'closed_mode'<>'null'::jsonb or v_original->'closed_to_arrival_mode'<>'null'::jsonb
            or v_original->'closed_to_departure_mode'<>'null'::jsonb
            or v_payload->>'closed_mode'='set' or v_payload->>'closed_to_arrival_mode'='set'
            or v_payload->>'closed_to_departure_mode'='set')
          and ((v_payload?'closed_mode' and (v_payload->>'closed_mode' is distinct from v_original->>'closed_mode'
            or case when v_payload->>'closed_mode'='clear' then null else (v_payload->>'closed')::boolean end is distinct from (v_original->>'closed')::boolean))
          or (v_payload?'closed_to_arrival_mode' and (v_payload->>'closed_to_arrival_mode' is distinct from v_original->>'closed_to_arrival_mode'
            or case when v_payload->>'closed_to_arrival_mode'='clear' then null else (v_payload->>'closed_to_arrival')::boolean end is distinct from (v_original->>'closed_to_arrival')::boolean))
          or (v_payload?'closed_to_departure_mode' and (v_payload->>'closed_to_departure_mode' is distinct from v_original->>'closed_to_departure_mode'
            or case when v_payload->>'closed_to_departure_mode'='clear' then null else (v_payload->>'closed_to_departure')::boolean end is distinct from (v_original->>'closed_to_departure')::boolean))
          or (v_payload?'availability_expires_at'
            and (v_original->'closed_mode'<>'null'::jsonb or v_original->'closed_to_arrival_mode'<>'null'::jsonb
              or v_original->'closed_to_departure_mode'<>'null'::jsonb)
            and v_payload->'availability_expires_at' is distinct from v_original->'availability_expires_at')));
        v_operation_changed:=v_operation_changed or (v_original is not null
          and (v_original->'closed_mode'<>'null'::jsonb or v_original->'closed_to_arrival_mode'<>'null'::jsonb
            or v_original->'closed_to_departure_mode'<>'null'::jsonb)
          and not coalesce((v_original->>'availability_active')::boolean,false)
          and (v_payload->>'closed_mode'='set' or v_payload->>'closed_to_arrival_mode'='set'
            or v_payload->>'closed_to_departure_mode'='set'
            or v_original->'closed_mode'<>'null'::jsonb or v_original->'closed_to_arrival_mode'<>'null'::jsonb
            or v_original->'closed_to_departure_mode'<>'null'::jsonb));
        if not v_operation_changed then continue; end if;
        v_operation:=jsonb_build_object('entity','operational_override','action',case when v_original is null then 'create' else 'update' end,
          'id',v_id,'expected_version',coalesce((v_original->>'availability_version')::bigint,0),
          'expected_original',coalesce(v_original,'{}'::jsonb),'payload',
          (v_payload-'valid_from'-'valid_to'-'weekdays')||jsonb_build_object('room_rate_id',v_rate_id,'stay_date',v_day,'availability_active',true));
        v_operations:=v_operations||jsonb_build_array(v_operation);
        v_impacts:=v_impacts||jsonb_build_array(jsonb_build_object('entity','operational_override','action',v_operation->>'action',
          'id',v_id,'changed',true,'affected_room_type_ids',(select jsonb_build_array(room_type_id) from public.hotel_room_rates where id=v_rate_id),
          'affected_room_rate_ids',jsonb_build_array(v_rate_id),'from',v_day,'to',v_day));
        v_operation_changed:=true; v_changed:=true;
      end loop;
      continue;
    end if;

    if v_entity='daily_inventory' and v_action in('upsert','delete') then
      if v_id is not null then raise exception using errcode='22023',message='hotels_v2_admin_d_daily_inventory_id_must_be_null'; end if;
      if not public.hotel_v2_admin_d_keys_allowed(v_payload,array['room_type_id','stay_date','sellable_units','sellable_units_mode','closed','closed_mode','reason','expires_at'])
         or not (v_payload ?& array['room_type_id','stay_date']) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_daily_inventory'; end if;
      if not exists(select 1 from public.hotel_room_types where id=(v_payload->>'room_type_id')::uuid and hotel_id=v_hotel_id) then
        raise exception using errcode='23503',message='hotels_v2_admin_d_foreign_room_type'; end if;
      if (v_payload->>'stay_date')::date not between v_from and v_to then
        raise exception using errcode='22023',message='hotels_v2_admin_d_inventory_outside_reviewed_range'; end if;
      select jsonb_build_object('room_type_id',room_type_id,'stay_date',stay_date,'sellable_units',sellable_units,
        'sellable_units_mode',sellable_units_mode,'closed',closed,'closed_mode',closed_mode,'reason',reason,
        'expires_at',expires_at,'version',version) into v_original from public.hotel_daily_inventory
        where room_type_id=(v_payload->>'room_type_id')::uuid and stay_date=(v_payload->>'stay_date')::date;
      v_id:=coalesce(v_id,public.hotel_v2_admin_d_deterministic_uuid((v_payload->>'room_type_id')||':'||(v_payload->>'stay_date')));
      if v_action='delete' then
        if not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason') then
          raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_daily_inventory'; end if;
        v_operation_changed:=v_original is not null;
      else
        if not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason')
           or (not (v_payload ?& array['sellable_units','sellable_units_mode'])
             and not (v_payload ?& array['closed','closed_mode']) and not (v_payload?'expires_at'))
           or ((v_payload?'sellable_units') is distinct from (v_payload?'sellable_units_mode'))
           or ((v_payload?'closed') is distinct from (v_payload?'closed_mode'))
           or (v_payload ? 'sellable_units_mode' and (v_payload->>'sellable_units_mode' not in('set','clear')
             or (v_payload->>'sellable_units_mode'='set' and (jsonb_typeof(v_payload->'sellable_units')<>'number' or v_payload->>'sellable_units'!~'^(0|[1-9][0-9]*)$' or (v_payload->>'sellable_units')::integer<0))
             or (v_payload->>'sellable_units_mode'='clear' and jsonb_typeof(v_payload->'sellable_units')<>'null')))
           or (v_payload ? 'closed_mode' and (v_payload->>'closed_mode' not in('set','clear')
             or (v_payload->>'closed_mode'='set' and jsonb_typeof(v_payload->'closed')<>'boolean')
             or (v_payload->>'closed_mode'='clear' and jsonb_typeof(v_payload->'closed')<>'null'))) then
          raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_daily_inventory'; end if;
        if v_original is null then
          select case when inventory_mode='unitized' then
              (select count(*) from public.hotel_units where room_type_id=(v_payload->>'room_type_id')::uuid and status='active')
            else base_inventory_count end into v_room_capacity
          from public.hotel_room_types where id=(v_payload->>'room_type_id')::uuid;
          v_operation_changed:=coalesce(
              v_payload->>'sellable_units_mode'='set'
                and (v_payload->>'sellable_units')::integer is distinct from v_room_capacity,
              false)
            or coalesce(
              v_payload->>'closed_mode'='set'
                and (v_payload->>'closed')::boolean is distinct from false,
              false);
        else
          v_operation_changed:=(v_payload ? 'sellable_units' and case when v_payload->>'sellable_units_mode'='clear' then v_original->>'sellable_units_mode'<>'clear'
            else (v_payload->>'sellable_units')::integer is distinct from (v_original->>'sellable_units')::integer or v_original->>'sellable_units_mode'<>'set' end)
          or (v_payload ? 'sellable_units_mode' and v_payload->>'sellable_units_mode' is distinct from v_original->>'sellable_units_mode')
          or (v_payload ? 'closed' and case when v_payload->>'closed_mode'='clear' then v_original->>'closed_mode'<>'clear'
            else (v_payload->>'closed')::boolean is distinct from (v_original->>'closed')::boolean or v_original->>'closed_mode'<>'set' end)
          or (v_payload ? 'closed_mode' and v_payload->>'closed_mode' is distinct from v_original->>'closed_mode')
          or (v_payload ? 'expires_at' and (v_original->>'sellable_units_mode'='set' or v_original->>'closed_mode'='set')
            and v_payload->'expires_at' is distinct from v_original->'expires_at');
        end if;
      end if;

    elsif v_entity='unit_calendar_block' and v_action in('create','update','disable') then
      if v_id is null or not public.hotel_v2_admin_d_keys_allowed(v_payload,
        case when v_action='disable' then array['reason'] else array['unit_id','room_type_id','from_date','to_date','blocked','reason','expires_at','is_active'] end) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_unit_calendar_block'; end if;
      if v_action<>'disable' and not (v_payload ?& array['unit_id','room_type_id','from_date','to_date','blocked','reason','expires_at','is_active']) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_unit_calendar_block'; end if;
      select jsonb_build_object('id',id,'hotel_id',hotel_id,'room_type_id',room_type_id,'unit_id',unit_id,
        'from_date',from_date,'to_date',to_date,'blocked',blocked,'reason',reason,'expires_at',expires_at,
        'is_active',is_active,'version',version) into v_original from public.hotel_unit_calendar_blocks where id=v_id and hotel_id=v_hotel_id;
      if v_action<>'disable' and (coalesce((v_payload->>'from_date')::date,(v_original->>'from_date')::date)<v_from
         or coalesce((v_payload->>'to_date')::date,(v_original->>'to_date')::date)>v_to) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_unit_block_outside_reviewed_range'; end if;
      if v_action='create' then
        if v_original is not null or not (v_payload ?& array['unit_id','room_type_id','from_date','to_date','reason']) then
          raise exception using errcode='23514',message='hotels_v2_admin_d_invalid_unit_calendar_block_create'; end if;
        if (v_payload?'blocked' and (v_payload->>'blocked')::boolean is not true)
           or (v_payload?'is_active' and (v_payload->>'is_active')::boolean is not true) then
          raise exception using errcode='22023',message='hotels_v2_admin_d_inert_unit_block_create'; end if;
        if not exists(select 1 from public.hotel_units unit join public.hotel_room_types room on room.id=unit.room_type_id
          where unit.id=(v_payload->>'unit_id')::uuid and unit.status='active'
            and room.id=(v_payload->>'room_type_id')::uuid and room.hotel_id=v_hotel_id
            and room.status='active' and room.inventory_mode='unitized') then
          raise exception using errcode='23503',message='hotels_v2_admin_d_foreign_unit'; end if;
      elsif v_original is null then raise exception using errcode='PT404',message='hotels_v2_admin_d_unit_calendar_block_not_found'; end if;
      if v_action<>'create' and ((v_payload?'unit_id' and v_payload->'unit_id' is distinct from v_original->'unit_id')
        or (v_payload?'room_type_id' and v_payload->'room_type_id' is distinct from v_original->'room_type_id')) then
        raise exception using errcode='23514',message='hotels_v2_admin_d_unit_block_identity_immutable'; end if;
      if not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason')
        or (v_action<>'disable' and (
          (v_payload?'blocked' and jsonb_typeof(v_payload->'blocked')<>'boolean')
        or (v_payload?'is_active' and jsonb_typeof(v_payload->'is_active')<>'boolean')
        or (v_payload->>'to_date')::date<(v_payload->>'from_date')::date)) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_unit_calendar_block'; end if;
      if v_action='update' and (v_payload->>'blocked')::boolean and (v_payload->>'is_active')::boolean
         and not exists(select 1 from public.hotel_units unit join public.hotel_room_types room on room.id=unit.room_type_id
           where unit.id=(v_payload->>'unit_id')::uuid and unit.status='active'
             and room.id=(v_payload->>'room_type_id')::uuid and room.hotel_id=v_hotel_id
             and room.status='active' and room.inventory_mode='unitized') then
        raise exception using errcode='23514',message='hotels_v2_admin_d_unit_block_requires_active_unitized_room'; end if;
      if v_action<>'disable' and (v_payload->>'blocked')::boolean and (v_payload->>'is_active')::boolean
         and exists(select 1 from public.hotel_unit_calendar_blocks overlap
           where overlap.unit_id=(v_payload->>'unit_id')::uuid and overlap.id<>v_id
             and overlap.is_active and overlap.blocked
             and (overlap.expires_at is null or overlap.expires_at>statement_timestamp())
             and daterange(overlap.from_date,overlap.to_date,'[]') &&
               daterange((v_payload->>'from_date')::date,(v_payload->>'to_date')::date,'[]')) then
        raise exception using errcode='23514',message='hotels_v2_admin_d_unit_block_overlap'; end if;
      v_operation_changed:=v_action='create' or v_action='disable' and coalesce((v_original->>'is_active')::boolean,false)
        or v_action='update' and (v_payload-'unit_id'-'room_type_id') is distinct from
          jsonb_build_object('from_date',v_original->'from_date','to_date',v_original->'to_date',
            'blocked',v_original->'blocked','reason',v_original->'reason','expires_at',v_original->'expires_at','is_active',v_original->'is_active');

    elsif v_entity='operational_override' and v_action in('create','update','disable') then
      if v_id is null or not public.hotel_v2_admin_d_keys_allowed(v_payload,
        case when v_action='disable' then array['reason'] else array['room_rate_id','stay_date','closed','closed_mode','closed_to_arrival','closed_to_arrival_mode','closed_to_departure','closed_to_departure_mode','reason','availability_expires_at','availability_active'] end) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operational_override'; end if;
      select jsonb_build_object('id',id,'hotel_id',hotel_id,'room_rate_id',room_rate_id,'stay_date',stay_date,
        'closed',closed,'closed_mode',closed_mode,'closed_to_arrival',closed_to_arrival,
        'closed_to_arrival_mode',closed_to_arrival_mode,'closed_to_departure',closed_to_departure,
        'closed_to_departure_mode',closed_to_departure_mode,
        'availability_reason',case when availability_updated_at is null then
          case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then reason end
          else availability_reason end,
        'availability_expires_at',case when availability_updated_at is null then
          case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then expires_at end
          else availability_expires_at end,
        'availability_active',case when availability_updated_at is null then
          (closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null) and is_active
          else availability_active end,
        'availability_version',availability_version) into v_original from public.hotel_calendar_overrides where id=v_id and hotel_id=v_hotel_id;
      if coalesce((v_payload->>'stay_date')::date,(v_original->>'stay_date')::date) not between v_from and v_to then
        raise exception using errcode='22023',message='hotels_v2_admin_d_operational_override_outside_reviewed_range'; end if;
      if v_action='create' then
        if v_original is not null or not (v_payload ?& array['room_rate_id','stay_date','reason'])
           or not exists(select 1 from public.hotel_room_rates where id=(v_payload->>'room_rate_id')::uuid and hotel_id=v_hotel_id) then
          raise exception using errcode='23514',message='hotels_v2_admin_d_invalid_operational_override_create'; end if;
        if exists(select 1 from public.hotel_calendar_overrides where room_rate_id=(v_payload->>'room_rate_id')::uuid and stay_date=(v_payload->>'stay_date')::date) then
          raise exception using errcode='PT409',message='hotels_v2_admin_d_operational_override_key_exists'; end if;
        if v_payload?'availability_active' and (v_payload->>'availability_active')::boolean is not true then
          raise exception using errcode='22023',message='hotels_v2_admin_d_inert_operational_override_create'; end if;
      elsif v_original is null then raise exception using errcode='PT404',message='hotels_v2_admin_d_operational_override_not_found'; end if;
      if v_action<>'create' and ((v_payload?'room_rate_id' and v_payload->'room_rate_id' is distinct from v_original->'room_rate_id')
        or (v_payload?'stay_date' and v_payload->'stay_date' is distinct from v_original->'stay_date')) then
        raise exception using errcode='23514',message='hotels_v2_admin_d_operational_override_identity_immutable'; end if;
      if not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason')
         or (v_action<>'disable' and v_payload?'availability_active' and jsonb_typeof(v_payload->'availability_active')<>'boolean') then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operational_override'; end if;
      if v_action<>'disable' and (
        (v_payload?'closed' and not v_payload?'closed_mode')
        or (v_payload?'closed_to_arrival' and not v_payload?'closed_to_arrival_mode')
        or (v_payload?'closed_to_departure' and not v_payload?'closed_to_departure_mode')
        or (v_payload?'closed_mode' and (v_payload->>'closed_mode' not in('set','clear','no_change')
          or (v_payload->>'closed_mode'='set' and jsonb_typeof(v_payload->'closed')<>'boolean')
          or (v_payload->>'closed_mode'='clear' and jsonb_typeof(v_payload->'closed')<>'null')
          or (v_payload->>'closed_mode'='no_change' and v_payload?'closed')))
        or (v_payload?'closed_to_arrival_mode' and (v_payload->>'closed_to_arrival_mode' not in('set','clear','no_change')
          or (v_payload->>'closed_to_arrival_mode'='set' and jsonb_typeof(v_payload->'closed_to_arrival')<>'boolean')
          or (v_payload->>'closed_to_arrival_mode'='clear' and jsonb_typeof(v_payload->'closed_to_arrival')<>'null')
          or (v_payload->>'closed_to_arrival_mode'='no_change' and v_payload?'closed_to_arrival')))
        or (v_payload?'closed_to_departure_mode' and (v_payload->>'closed_to_departure_mode' not in('set','clear','no_change')
          or (v_payload->>'closed_to_departure_mode'='set' and jsonb_typeof(v_payload->'closed_to_departure')<>'boolean')
          or (v_payload->>'closed_to_departure_mode'='clear' and jsonb_typeof(v_payload->'closed_to_departure')<>'null')
          or (v_payload->>'closed_to_departure_mode'='no_change' and v_payload?'closed_to_departure')))) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operational_override_modes'; end if;
      if v_payload->>'closed_mode'='no_change' then v_payload:=v_payload-'closed_mode'-'closed'; end if;
      if v_payload->>'closed_to_arrival_mode'='no_change' then v_payload:=v_payload-'closed_to_arrival_mode'-'closed_to_arrival'; end if;
      if v_payload->>'closed_to_departure_mode'='no_change' then v_payload:=v_payload-'closed_to_departure_mode'-'closed_to_departure'; end if;
      if v_action='update' and not (v_payload?'availability_active')
         and v_original->'closed_mode'='null'::jsonb
         and v_original->'closed_to_arrival_mode'='null'::jsonb
         and v_original->'closed_to_departure_mode'='null'::jsonb
         and (v_payload->>'closed_mode'='set' or v_payload->>'closed_to_arrival_mode'='set'
           or v_payload->>'closed_to_departure_mode'='set') then
        v_payload:=jsonb_set(v_payload,'{availability_active}','true'::jsonb,true);
      end if;
      if v_action in('create','update') and not (v_payload?'availability_active') then
        v_payload:=jsonb_set(v_payload,'{availability_active}',
          to_jsonb(coalesce((v_original->>'availability_active')::boolean,true)),true);
      end if;
      v_operation_changed:=v_action='create' and
          (v_payload->>'closed_mode'='set' or v_payload->>'closed_to_arrival_mode'='set'
            or v_payload->>'closed_to_departure_mode'='set')
        or v_action='disable' and coalesce((v_original->>'availability_active')::boolean,false)
        or v_action='update'
          and (v_original->'closed_mode'<>'null'::jsonb or v_original->'closed_to_arrival_mode'<>'null'::jsonb
            or v_original->'closed_to_departure_mode'<>'null'::jsonb
            or v_payload->>'closed_mode'='set' or v_payload->>'closed_to_arrival_mode'='set'
            or v_payload->>'closed_to_departure_mode'='set')
          and (
          (v_payload?'closed_mode' and (v_payload->>'closed_mode' is distinct from v_original->>'closed_mode'
            or case when v_payload->>'closed_mode'='clear' then null else (v_payload->>'closed')::boolean end is distinct from (v_original->>'closed')::boolean))
          or (v_payload?'closed_to_arrival_mode' and (v_payload->>'closed_to_arrival_mode' is distinct from v_original->>'closed_to_arrival_mode'
            or case when v_payload->>'closed_to_arrival_mode'='clear' then null else (v_payload->>'closed_to_arrival')::boolean end is distinct from (v_original->>'closed_to_arrival')::boolean))
          or (v_payload?'closed_to_departure_mode' and (v_payload->>'closed_to_departure_mode' is distinct from v_original->>'closed_to_departure_mode'
            or case when v_payload->>'closed_to_departure_mode'='clear' then null else (v_payload->>'closed_to_departure')::boolean end is distinct from (v_original->>'closed_to_departure')::boolean))
          or (v_payload?'availability_active' and (v_payload->>'availability_active')::boolean is distinct from (v_original->>'availability_active')::boolean)
          or (v_payload?'availability_expires_at' and v_payload->'availability_expires_at' is distinct from v_original->'availability_expires_at'));

    elsif v_entity='rate_rule_operational_restriction' and v_action in('update','clear') then
      if v_id is null or not public.hotel_v2_admin_d_keys_allowed(v_payload,
        case when v_action='clear' then array['reason'] else array['closed_to_arrival','closed_to_departure','reason'] end)
         or not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason')
         or (v_action='update' and v_payload?'closed_to_arrival' and jsonb_typeof(v_payload->'closed_to_arrival')<>'boolean')
         or (v_action='update' and v_payload?'closed_to_departure' and jsonb_typeof(v_payload->'closed_to_departure')<>'boolean') then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_rate_rule_restriction'; end if;
      select jsonb_build_object('id',rule.id,'room_rate_id',rule.room_rate_id,
        'valid_from',rule.valid_from,'valid_to',rule.valid_to,'weekdays',rule.weekdays,
        'priority',rule.priority,'is_active',rule.is_active,
        'closed_to_arrival',rule.closed_to_arrival,'closed_to_departure',rule.closed_to_departure,
        'availability_reason',rule.availability_reason,'availability_version',rule.availability_version) into v_original
        from public.hotel_rate_rules rule join public.hotel_room_rates rate on rate.id=rule.room_rate_id
        where rule.id=v_id and rate.hotel_id=v_hotel_id;
      if v_original is null then raise exception using errcode='PT404',message='hotels_v2_admin_d_rate_rule_not_found'; end if;
      -- The overlapping snapshot binds the full immutable rule scope and its
      -- field-scoped availability version, so Review may acknowledge an
      -- affected scope wider than the current calendar viewport.
      if v_action='update' then
        if not (v_payload?'closed_to_arrival') then v_payload:=jsonb_set(v_payload,'{closed_to_arrival}',v_original->'closed_to_arrival',true); end if;
        if not (v_payload?'closed_to_departure') then v_payload:=jsonb_set(v_payload,'{closed_to_departure}',v_original->'closed_to_departure',true); end if;
      end if;
      v_operation_changed:=(v_action='clear' and ((v_original->>'closed_to_arrival')::boolean or (v_original->>'closed_to_departure')::boolean))
        or (v_action='update' and ((v_payload ? 'closed_to_arrival' and (v_payload->>'closed_to_arrival')::boolean is distinct from (v_original->>'closed_to_arrival')::boolean)
          or (v_payload ? 'closed_to_departure' and (v_payload->>'closed_to_departure')::boolean is distinct from (v_original->>'closed_to_departure')::boolean)));

    elsif v_entity='booking_allocation' and v_action in('map','release') then
      if not public.hotel_v2_admin_d_keys_allowed(v_payload,
        case when v_action='map' then array['booking_id','booking_updated_at','allocations'] else array['booking_id','reason'] end)
         or (v_action='map' and not (v_payload ?& array['booking_id','booking_updated_at','allocations']))
         or (v_action='release' and not (v_payload ?& array['booking_id','reason'])) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_booking_allocation'; end if;
      if (v_action='map' and v_id is not null)
         or (v_action='release' and (v_id is null or v_id<>(v_payload->>'booking_id')::uuid)) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_booking_allocation_identity_invalid'; end if;
      if v_action='release' and not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason') then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_booking_allocation'; end if;
      v_id:=coalesce(v_id,(v_payload->>'booking_id')::uuid);
      select jsonb_build_object('booking_id',booking.id,'booking_updated_at',booking.updated_at,
        'arrival_date',booking.arrival_date,'departure_date',booking.departure_date,'status',booking.status,
        'num_adults',coalesce(booking.num_adults,1),'num_children',coalesce(booking.num_children,0),
        'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',allocation.id,
          'room_type_id',allocation.room_type_id,'rate_plan_id',allocation.rate_plan_id,'room_rate_id',allocation.room_rate_id,
          'unit_ids',allocation.unit_ids,'units_required',allocation.units_required,
          'allocated_guest_counts',allocation.allocated_guest_counts,'pricing_guest_counts',allocation.pricing_guest_counts)
          order by allocation.id) from public.hotel_booking_room_allocations allocation
          where allocation.booking_id=booking.id and allocation.status='active'),'[]'::jsonb),
        'commitments',coalesce((select jsonb_agg(jsonb_build_object('room_type_id',commitment.room_type_id,
          'stay_date',commitment.stay_date,'unit_id',commitment.unit_id,'units',commitment.units,
          'status',commitment.status) order by commitment.room_type_id,commitment.stay_date,
            commitment.unit_id nulls first,commitment.units)
          from public.hotel_inventory_commitments commitment join public.hotel_booking_room_allocations allocation
            on allocation.id=commitment.booking_allocation_id
          where allocation.booking_id=booking.id and allocation.status='active' and commitment.status='active'),'[]'::jsonb))
        into v_original from public.hotel_bookings booking where booking.id=(v_payload->>'booking_id')::uuid and booking.hotel_id=v_hotel_id;
      if v_original is null then raise exception using errcode='PT404',message='hotels_v2_admin_d_booking_not_found'; end if;
      if (v_original->>'arrival_date')::date<v_from or (v_original->>'departure_date')::date-1>v_to
         or exists(select 1 from jsonb_array_elements(v_original->'commitments') commitment(value)
           where (commitment.value->>'stay_date')::date not between v_from and v_to) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_booking_outside_reviewed_range'; end if;
      if v_action='map' and jsonb_typeof(v_payload->'allocations')<>'array' then raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_booking_allocation'; end if;
      if v_action='map' then
        if jsonb_array_length(v_payload->'allocations') not between 1 and 1000
           or jsonb_array_length(v_payload->'allocations')<>(select count(distinct item.value->>'id')
          from jsonb_array_elements(v_payload->'allocations') item(value)) then
          raise exception using errcode='22023',message='hotels_v2_admin_d_duplicate_booking_allocation_id'; end if;
        select * into v_booking from public.hotel_bookings where id=(v_payload->>'booking_id')::uuid and hotel_id=v_hotel_id;
        if v_booking.status not in('pending','confirmed') or v_booking.updated_at is distinct from (v_payload->>'booking_updated_at')::timestamptz
           or v_booking.arrival_date<v_from or v_booking.departure_date-1>v_to then
          raise exception using errcode='PT409',message='hotels_v2_admin_d_booking_stale'; end if;
        v_guest_sum:=0;
        for v_item in select value from jsonb_array_elements(v_payload->'allocations') loop
          if jsonb_typeof(v_item)<>'object' or not public.hotel_v2_admin_d_keys_allowed(v_item,
            array['id','room_type_id','rate_plan_id','room_rate_id','unit_ids','units_required','allocated_guest_counts','pricing_guest_counts'])
             or not (v_item ?& array['id','room_type_id','rate_plan_id','room_rate_id','unit_ids','units_required','allocated_guest_counts','pricing_guest_counts'])
             or jsonb_typeof(v_item->'units_required')<>'number' or v_item->>'units_required'!~'^[1-9][0-9]*$'
             or jsonb_typeof(v_item->'unit_ids')<>'array' or jsonb_typeof(v_item->'allocated_guest_counts')<>'array'
             or jsonb_typeof(v_item->'pricing_guest_counts')<>'array' then
            raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_booking_allocation'; end if;
          if not exists(select 1 from public.hotel_room_rates rate join public.hotel_room_types room on room.id=rate.room_type_id
            where rate.id=(v_item->>'room_rate_id')::uuid and rate.hotel_id=v_hotel_id
              and rate.room_type_id=(v_item->>'room_type_id')::uuid and rate.rate_plan_id=(v_item->>'rate_plan_id')::uuid) then
            raise exception using errcode='23503',message='hotels_v2_admin_d_foreign_room_rate'; end if;
          select coalesce(max_occupancy,capacity_adults+capacity_children),inventory_mode into v_room_capacity,v_inventory_mode
            from public.hotel_room_types where id=(v_item->>'room_type_id')::uuid;
          if v_room_capacity is null or (v_item->>'units_required')::integer not between 1 and 1000
             or jsonb_array_length(v_item->'allocated_guest_counts')<>(v_item->>'units_required')::integer
             or jsonb_array_length(v_item->'pricing_guest_counts')<>(v_item->>'units_required')::integer
             or exists(select 1 from jsonb_array_elements(v_item->'allocated_guest_counts') n(value)
               where jsonb_typeof(n.value)<>'number' or n.value#>>'{}'!~'^[1-9][0-9]*$'
                 or (n.value#>>'{}')::integer>50 or (n.value#>>'{}')::integer>v_room_capacity)
             or exists(select 1 from jsonb_array_elements(v_item->'pricing_guest_counts') n(value)
               where jsonb_typeof(n.value)<>'number' or n.value#>>'{}'!~'^[1-9][0-9]*$'
                 or (n.value#>>'{}')::integer>50 or (n.value#>>'{}')::integer>v_room_capacity) then
            raise exception using errcode='23514',message='hotels_v2_admin_d_allocation_capacity_invalid'; end if;
          if (v_inventory_mode='pooled' and jsonb_array_length(v_item->'unit_ids')<>0)
             or (v_inventory_mode='unitized' and jsonb_array_length(v_item->'unit_ids')<>(v_item->>'units_required')::integer)
             or jsonb_array_length(v_item->'unit_ids')<>(select count(distinct value) from jsonb_array_elements_text(v_item->'unit_ids') unit_value(value))
             or exists(select 1 from jsonb_array_elements_text(v_item->'unit_ids') unit_value(value)
               left join public.hotel_units unit on unit.id=unit_value.value::uuid and unit.room_type_id=(v_item->>'room_type_id')::uuid and unit.status='active'
               where unit.id is null) then
            raise exception using errcode='23514',message='hotels_v2_admin_d_allocation_units_invalid'; end if;
          v_guest_sum:=v_guest_sum+(select sum(value::integer) from jsonb_array_elements_text(v_item->'allocated_guest_counts') n(value));
        end loop;
        if exists(select 1 from jsonb_array_elements(v_payload->'allocations') item(value)
          cross join lateral jsonb_array_elements_text(item.value->'unit_ids') unit_value(value)
          group by unit_value.value having count(*)>1) then
          raise exception using errcode='23514',message='hotels_v2_admin_d_duplicate_allocated_unit'; end if;
        if exists(select 1 from jsonb_array_elements(v_payload->'allocations') item(value)
          join public.hotel_booking_room_allocations allocation on allocation.id=(item.value->>'id')::uuid) then
          raise exception using errcode='23505',message='hotels_v2_admin_d_booking_allocation_id_already_used'; end if;
        if v_guest_sum<>coalesce(v_booking.num_adults,1)+coalesce(v_booking.num_children,0) then
          raise exception using errcode='23514',message='hotels_v2_admin_d_allocation_guest_total_mismatch'; end if;
        select jsonb_set(v_payload,'{allocations}',coalesce(jsonb_agg(item.value order by item.value->>'id'),'[]'::jsonb),true)
          into v_payload from jsonb_array_elements(v_payload->'allocations') item(value);
        select coalesce(jsonb_agg(jsonb_build_object('room_type_id',expected.room_type_id,
          'stay_date',expected.stay_date,'unit_id',expected.unit_id,'units',expected.units,'status','active')
          order by expected.room_type_id,expected.stay_date,expected.unit_id nulls first,expected.units),'[]'::jsonb)
          into v_expected_commitments from(
            select (item.value->>'room_type_id')::uuid room_type_id,day_value::date stay_date,
              null::uuid unit_id,(item.value->>'units_required')::integer units
            from jsonb_array_elements(v_payload->'allocations') item(value)
            cross join generate_series(v_booking.arrival_date,v_booking.departure_date-1,interval '1 day') day_value
            where jsonb_array_length(item.value->'unit_ids')=0
            union all
            select (item.value->>'room_type_id')::uuid,day_value::date,(unit_value.value#>>'{}')::uuid,1
            from jsonb_array_elements(v_payload->'allocations') item(value)
            cross join generate_series(v_booking.arrival_date,v_booking.departure_date-1,interval '1 day') day_value
            cross join lateral jsonb_array_elements(item.value->'unit_ids') unit_value(value)
          ) expected;
        v_operation_changed:=v_original->'allocations' is distinct from v_payload->'allocations'
          or v_original->'commitments' is distinct from v_expected_commitments
          or exists(select 1 from public.hotel_booking_room_allocations allocation
            where allocation.booking_id=v_booking.id and allocation.status='active'
              and allocation.booking_updated_at is distinct from v_booking.updated_at);
      else v_operation_changed:=jsonb_array_length(v_original->'allocations')>0; end if;

    elsif v_entity='hold' and v_action='release' then
      if v_id is null or not public.hotel_v2_admin_d_keys_allowed(v_payload,array['reason'])
         or not public.hotel_v2_admin_d_reason_is_valid(v_payload->'reason') then
        raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_hold_release'; end if;
      select jsonb_build_object('id',hold_row.id,'status',hold_row.status,'expires_at',hold_row.expires_at,
        'version',hold_row.version,'commitments',coalesce((select jsonb_agg(jsonb_build_object(
          'room_type_id',commitment.room_type_id,'stay_date',commitment.stay_date,'unit_id',commitment.unit_id,
          'units',commitment.units,'status',commitment.status) order by commitment.stay_date,commitment.id)
          from public.hotel_inventory_commitments commitment where commitment.hold_id=hold_row.id
            and commitment.status='active'),'[]'::jsonb))
        into v_original from public.hotel_inventory_holds hold_row where hold_row.id=v_id and hold_row.hotel_id=v_hotel_id;
      if v_original is null then raise exception using errcode='PT404',message='hotels_v2_admin_d_hold_not_found'; end if;
      if exists(select 1 from public.hotel_inventory_commitments commitment where commitment.hold_id=v_id
        and commitment.status='active' and commitment.stay_date not between v_from and v_to) then
        raise exception using errcode='22023',message='hotels_v2_admin_d_hold_outside_reviewed_range'; end if;
      v_operation_changed:=v_original->>'status'='active' and jsonb_array_length(v_original->'commitments')>0;
    else
      raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_intent_contract';
    end if;

    if not v_operation_changed then continue; end if;
    v_changed:=true;
    v_operation:=jsonb_build_object('entity',v_entity,'action',v_action,'id',v_id,
      'expected_version',coalesce((v_original->>'availability_version')::bigint,(v_original->>'version')::bigint,0),
      'expected_original',coalesce(v_original,'{}'::jsonb),'payload',v_payload);
    v_operations:=v_operations||jsonb_build_array(v_operation);
    v_impact_rooms:='[]'::jsonb; v_impact_rates:='[]'::jsonb; v_impact_from:=v_from; v_impact_to:=v_to;
    if v_entity='daily_inventory' then v_impact_rooms:=jsonb_build_array(v_payload->'room_type_id'); v_impact_from:=(v_payload->>'stay_date')::date; v_impact_to:=v_impact_from;
    elsif v_entity='unit_calendar_block' then v_impact_rooms:=jsonb_build_array(coalesce(v_payload->'room_type_id',v_original->'room_type_id')); v_impact_from:=coalesce((v_payload->>'from_date')::date,(v_original->>'from_date')::date); v_impact_to:=coalesce((v_payload->>'to_date')::date,(v_original->>'to_date')::date);
    elsif v_entity='operational_override' then v_impact_rates:=jsonb_build_array(coalesce(v_payload->'room_rate_id',v_original->'room_rate_id')); v_impact_rooms:=coalesce((select jsonb_build_array(room_type_id) from public.hotel_room_rates where id=(coalesce(v_payload->>'room_rate_id',v_original->>'room_rate_id'))::uuid),'[]'::jsonb); v_impact_from:=coalesce((v_payload->>'stay_date')::date,(v_original->>'stay_date')::date); v_impact_to:=v_impact_from;
    elsif v_entity='rate_rule_operational_restriction' then
      v_impact_rates:=jsonb_build_array(v_original->'room_rate_id');
      v_impact_rooms:=coalesce((select jsonb_build_array(room_type_id) from public.hotel_room_rates where id=(v_original->>'room_rate_id')::uuid),'[]'::jsonb);
      v_impact_from:=(v_original->>'valid_from')::date; v_impact_to:=(v_original->>'valid_to')::date;
    elsif v_entity='booking_allocation' then
      select least(booking.arrival_date,coalesce((select min((commitment.value->>'stay_date')::date)
          from jsonb_array_elements(v_original->'commitments') commitment(value)),booking.arrival_date)),
        greatest(booking.departure_date-1,coalesce((select max((commitment.value->>'stay_date')::date)
          from jsonb_array_elements(v_original->'commitments') commitment(value)),booking.departure_date-1))
        into v_impact_from,v_impact_to from public.hotel_bookings booking where booking.id=(v_payload->>'booking_id')::uuid;
      if v_action='map' then
        select coalesce(jsonb_agg(distinct item.value->'room_type_id'),'[]'::jsonb),
          coalesce(jsonb_agg(distinct item.value->'room_rate_id'),'[]'::jsonb)
          into v_impact_rooms,v_impact_rates from jsonb_array_elements(v_payload->'allocations') item(value);
      else
        select coalesce(jsonb_agg(distinct item.value->'room_type_id'),'[]'::jsonb),
          coalesce(jsonb_agg(distinct item.value->'room_rate_id'),'[]'::jsonb)
          into v_impact_rooms,v_impact_rates from jsonb_array_elements(v_original->'allocations') item(value);
      end if;
    elsif v_entity='hold' then
      select coalesce(jsonb_agg(distinct to_jsonb(commitment.room_type_id)),'[]'::jsonb),
        min(commitment.stay_date),max(commitment.stay_date)
        into v_impact_rooms,v_impact_from,v_impact_to
      from public.hotel_inventory_commitments commitment
      where commitment.hold_id=v_id and commitment.status='active';
    end if;
    v_impacts:=v_impacts||jsonb_build_array(jsonb_build_object('entity',v_entity,'action',v_action,'id',v_id,
      'changed',true,'affected_room_type_ids',v_impact_rooms,'affected_room_rate_ids',v_impact_rates,
      'from',v_impact_from,'to',v_impact_to));
  end loop;

  if exists(select 1 from jsonb_array_elements(v_operations) a(value)
    group by a.value->>'entity',a.value->>'id' having count(*)>1) then
    raise exception using errcode='22023',message='hotels_v2_admin_d_duplicate_plan_target'; end if;
  if jsonb_array_length(v_operations)>100 then
    raise exception using errcode='22023',message='hotels_v2_admin_d_plan_operation_limit_exceeded'; end if;
  v_plan:=jsonb_build_object('contract_version','hotels_v2_admin_d_availability_plan_v1',
    'hotel_id',v_hotel_id,'from',v_from,'to',v_to,'snapshot_token',v_control->>'snapshot_token',
    'reviewed_at',clock_timestamp(),'operations',v_operations);
  if exists(select 1 from jsonb_array_elements(v_operations) operation(value)
      where octet_length(convert_to((operation.value->'expected_original')::text,'UTF8'))>262144)
     or octet_length(convert_to(v_plan::text,'UTF8'))>10485760 then
    raise exception using errcode='54000',message='hotels_v2_admin_d_review_output_technical_limit_exceeded';
  end if;
  v_fingerprint:=public.hotel_v2_admin_d_hash(v_plan);
  v_plan:=v_plan||jsonb_build_object('plan_fingerprint',v_fingerprint);
  insert into public.hotel_admin_availability_plan_reviews(actor_id,plan_fingerprint,hotel_id,
    reviewed_plan,snapshot_token,expires_at)
  values(auth.uid(),v_fingerprint,v_hotel_id,v_plan,v_control->>'snapshot_token',clock_timestamp()+interval '30 minutes');
  return jsonb_build_object('contract_version','hotels_v2_admin_d_availability_plan_preview_v1',
    'hotel_id',v_hotel_id,'changed',v_changed,'impacts',v_impacts,'blocking_reasons','[]'::jsonb,
    'reviewed_plan',v_plan,'plan_fingerprint',v_fingerprint,'current_control',v_control);
exception when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
  raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_draft';
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_get_availability_control_114490(p_hotel_id uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$select public.hotel_v2_admin_d_snapshot_114490(p_hotel_id,p_from,p_to,true)$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_preview_availability_plan_114490(p_draft jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$select public.hotel_v2_admin_d_review_plan_114490(p_draft)$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_apply_availability_control_plan_114490(p_plan jsonb, p_correlation_id uuid, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_actor uuid:=auth.uid(); v_hotel_id uuid; v_from date; v_to date; v_reviewed_at timestamptz;
  v_request_hash text; v_expected_fingerprint text; v_receipt public.hotel_admin_availability_action_receipts%rowtype;
  v_review public.hotel_admin_availability_plan_reviews%rowtype;
  v_control jsonb; v_operation jsonb; v_entity text; v_action text; v_id uuid; v_payload jsonb;
  v_expected bigint; v_before jsonb; v_after jsonb; v_changed boolean:=false; v_op_changed boolean;
  v_activity jsonb:='[]'::jsonb; v_activity_id uuid; v_room_id uuid; v_date date; v_capacity integer;
  v_activity_created_at timestamptz; v_ledger_entity text; v_ledger_action text;
  v_booking public.hotel_bookings%rowtype; v_item jsonb; v_allocation public.hotel_booking_room_allocations%rowtype;
  v_unit_ids uuid[]; v_allocated smallint[]; v_pricing smallint[]; v_units integer; v_day date;
  v_result jsonb; v_reason text;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_plan is null or jsonb_typeof(p_plan)<>'object' or v_actor is null or p_correlation_id is null
     or not public.hotel_v2_admin_d_uuid_is_canonical(v_actor::text)
     or not public.hotel_v2_admin_d_uuid_is_canonical(p_correlation_id::text)
     or p_idempotency_key is null or p_idempotency_key!~'^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$'
     or not public.hotel_v2_admin_d_keys_allowed(p_plan,array['contract_version','hotel_id','from','to','snapshot_token','reviewed_at','operations','plan_fingerprint'])
     or p_plan->>'contract_version'<>'hotels_v2_admin_d_availability_plan_v1'
     or jsonb_typeof(p_plan->'operations')<>'array'
     or not public.hotel_v2_admin_d_json_dates_are_canonical(p_plan)
     or octet_length(convert_to(p_plan::text,'UTF8'))>10485760
     or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(p_plan->'operations')='array'
       then p_plan->'operations' else '[]'::jsonb end) operation(value)
       where octet_length(convert_to((operation.value->'expected_original')::text,'UTF8'))>262144) then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_plan'; end if;
  v_expected_fingerprint:=public.hotel_v2_admin_d_hash(p_plan-'plan_fingerprint');
  if p_plan->>'plan_fingerprint' is distinct from v_expected_fingerprint then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_plan_fingerprint'; end if;
  begin v_hotel_id:=(p_plan->>'hotel_id')::uuid; v_from:=(p_plan->>'from')::date;
    v_to:=(p_plan->>'to')::date; v_reviewed_at:=(p_plan->>'reviewed_at')::timestamptz;
  exception when others then raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_plan'; end;
  if v_to<v_from or v_to-v_from>364 or (v_to-v_from>61 and exists(
    select 1 from jsonb_array_elements(p_plan->'operations') operation(value)
    where operation.value->>'entity' not in('booking_allocation','hold'))) then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_availability_range'; end if;
  v_request_hash:=public.hotel_v2_admin_d_hash(jsonb_build_object('plan',p_plan,
    'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key));
  perform pg_advisory_xact_lock(hashtextextended('hotels-v2-admin-d-key:'||v_actor::text||':'||p_idempotency_key,0));
  perform pg_advisory_xact_lock(hashtextextended('hotels-v2-admin-d-correlation:'||p_correlation_id::text,0));
  select * into v_receipt from public.hotel_admin_availability_action_receipts
    where actor_id=v_actor and idempotency_key=p_idempotency_key for update;
  if found then
    if v_receipt.request_hash<>v_request_hash then raise exception using errcode='PT409',message='hotels_v2_admin_d_idempotency_conflict'; end if;
    return jsonb_set(v_receipt.result,'{replayed}','true'::jsonb,true);
  end if;
  if exists(select 1 from public.hotel_admin_availability_action_receipts receipt
      where receipt.correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_activity_log activity
      where activity.correlation_id=p_correlation_id) then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_correlation_conflict'; end if;
  if v_reviewed_at<clock_timestamp()-interval '30 minutes'
     or v_reviewed_at>clock_timestamp()+interval '5 minutes' then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_review_timestamp'; end if;
  select * into v_review from public.hotel_admin_availability_plan_reviews
    where actor_id=v_actor and plan_fingerprint=v_expected_fingerprint for update;
  if not found or v_review.hotel_id<>v_hotel_id or v_review.reviewed_plan is distinct from p_plan
     or v_review.snapshot_token is distinct from p_plan->>'snapshot_token'
     or v_review.expires_at<=clock_timestamp() or v_review.consumed_at is not null then
    raise exception using errcode='42501',message='hotels_v2_admin_d_review_required'; end if;
  perform 1 from public.hotels where id=v_hotel_id for update;
  if not found then raise exception using errcode='PT404',message='hotels_v2_admin_d_property_not_found'; end if;
  v_control:=public.hotel_v2_admin_d_snapshot_114490(v_hotel_id,v_from,v_to,false);
  if v_control->>'snapshot_token' is distinct from p_plan->>'snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_availability_snapshot'; end if;
  if exists(select 1 from jsonb_array_elements(p_plan->'operations') operation(value)
    where (operation.value#>'{payload,expires_at}' is not null
        and jsonb_typeof(operation.value#>'{payload,expires_at}')<>'null'
        and (operation.value#>>'{payload,expires_at}')::timestamptz<=statement_timestamp())
      or (operation.value#>'{payload,availability_expires_at}' is not null
        and jsonb_typeof(operation.value#>'{payload,availability_expires_at}')<>'null'
        and (operation.value#>>'{payload,availability_expires_at}')::timestamptz<=statement_timestamp())) then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_expiry_elapsed_since_review';
  end if;

  create temporary table if not exists pg_temp.hotel_admin_d_lock_days(
    room_type_id uuid not null,stay_date date not null,primary key(room_type_id,stay_date)) on commit drop;
  truncate pg_temp.hotel_admin_d_lock_days;
  for v_operation in select value from jsonb_array_elements(p_plan->'operations') loop
    v_entity:=v_operation->>'entity'; v_payload:=v_operation->'payload';
    if v_entity='daily_inventory' then
      insert into pg_temp.hotel_admin_d_lock_days values((v_payload->>'room_type_id')::uuid,(v_payload->>'stay_date')::date) on conflict do nothing;
    elsif v_entity='unit_calendar_block' and v_operation->>'action'<>'disable' then
      insert into pg_temp.hotel_admin_d_lock_days
      select (v_payload->>'room_type_id')::uuid,day_value::date from generate_series(
        (v_payload->>'from_date')::date,(v_payload->>'to_date')::date,interval '1 day') day_value on conflict do nothing;
    elsif v_entity='unit_calendar_block' then
      insert into pg_temp.hotel_admin_d_lock_days
      select block.room_type_id,day_value::date from public.hotel_unit_calendar_blocks block
      cross join generate_series(block.from_date,block.to_date,interval '1 day') day_value where block.id=(v_operation->>'id')::uuid on conflict do nothing;
    elsif v_entity='booking_allocation' then
      select * into v_booking from public.hotel_bookings where id=(v_payload->>'booking_id')::uuid and hotel_id=v_hotel_id;
      if not found or v_booking.arrival_date<v_from or v_booking.departure_date-1>v_to then
        raise exception using errcode='22023',message='hotels_v2_admin_d_booking_outside_reviewed_range'; end if;
      insert into pg_temp.hotel_admin_d_lock_days
        select commitment.room_type_id,commitment.stay_date
        from public.hotel_inventory_commitments commitment
        join public.hotel_booking_room_allocations allocation on allocation.id=commitment.booking_allocation_id
        where allocation.booking_id=v_booking.id and allocation.status='active' and commitment.status='active'
        on conflict do nothing;
      if v_operation->>'action'='map' then
        insert into pg_temp.hotel_admin_d_lock_days
        select (item.value->>'room_type_id')::uuid,day_value::date
        from jsonb_array_elements(v_payload->'allocations') item(value)
        cross join generate_series(v_booking.arrival_date,v_booking.departure_date-1,interval '1 day') day_value on conflict do nothing;
      end if;
    elsif v_entity='hold' then
      insert into pg_temp.hotel_admin_d_lock_days
      select commitment.room_type_id,commitment.stay_date
      from public.hotel_inventory_commitments commitment
      where commitment.hold_id=(v_operation->>'id')::uuid and commitment.status='active'
      order by commitment.room_type_id,commitment.stay_date on conflict do nothing;
    end if;
  end loop;
  insert into public.hotel_inventory_day_locks(hotel_id,room_type_id,stay_date)
    select v_hotel_id,lock_day.room_type_id,lock_day.stay_date from pg_temp.hotel_admin_d_lock_days lock_day
    order by lock_day.room_type_id,lock_day.stay_date on conflict(room_type_id,stay_date) do nothing;
  perform pg_advisory_xact_lock(hashtextextended(target.room_type_id::text||':'||target.stay_date::text,0))
    from pg_temp.hotel_admin_d_lock_days target order by target.room_type_id,target.stay_date;
  perform 1 from public.hotel_inventory_day_locks day_lock join pg_temp.hotel_admin_d_lock_days target
    on target.room_type_id=day_lock.room_type_id and target.stay_date=day_lock.stay_date
    order by day_lock.room_type_id,day_lock.stay_date for update of day_lock;

  for v_operation in select value from jsonb_array_elements(p_plan->'operations') order by value->>'entity',value->>'id' loop
    if jsonb_typeof(v_operation)<>'object' or not public.hotel_v2_admin_d_keys_allowed(v_operation,
      array['entity','action','id','expected_version','expected_original','payload']) then
      raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operation'; end if;
    v_entity:=v_operation->>'entity'; v_action:=v_operation->>'action'; v_id:=(v_operation->>'id')::uuid;
    v_expected:=(v_operation->>'expected_version')::bigint; v_payload:=v_operation->'payload';
    v_before:=null; v_after:=null; v_op_changed:=false;

    if v_entity='daily_inventory' then
      v_room_id:=(v_payload->>'room_type_id')::uuid; v_date:=(v_payload->>'stay_date')::date;
      select jsonb_build_object('room_type_id',room_type_id,'stay_date',stay_date,'sellable_units',sellable_units,
        'sellable_units_mode',sellable_units_mode,'closed',closed,'closed_mode',closed_mode,'reason',reason,
        'expires_at',expires_at,'version',version) into v_before from public.hotel_daily_inventory
        where room_type_id=v_room_id and stay_date=v_date for update;
      if coalesce((v_before->>'version')::bigint,0)<>v_expected then raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_daily_inventory'; end if;
      if v_action='delete' then
        if v_before is not null then
          delete from public.hotel_daily_inventory where room_type_id=v_room_id and stay_date=v_date;
          v_after:=jsonb_build_object('room_type_id',v_room_id,'stay_date',v_date,
            'reason',v_payload->'reason','deleted',true,'version',(v_before->>'version')::bigint+1);
          v_op_changed:=true;
        end if;
      else
        select case when inventory_mode='unitized' then (select count(*) from public.hotel_units where room_type_id=v_room_id and status='active') else base_inventory_count end
          into v_capacity from public.hotel_room_types where id=v_room_id and hotel_id=v_hotel_id;
        if v_capacity is null or (v_payload->>'sellable_units')::integer>v_capacity then raise exception using errcode='23514',message='hotels_v2_admin_d_inventory_exceeds_physical_capacity'; end if;
        v_control:=public.hotel_v2_admin_d_snapshot_114490(v_hotel_id,v_date,v_date,false);
        if v_payload ? 'sellable_units' and
           coalesce((select least((cell.value->>'physical_capacity')::integer-
                 case when cell.value->>'inventory_mode'='unitized' then (cell.value->>'blocked_unit_count')::integer else 0 end,
               case when v_payload->>'sellable_units_mode'='clear' then (cell.value->>'physical_capacity')::integer
                 else (v_payload->>'sellable_units')::integer end)<(cell.value->>'committed_units')::integer
             from jsonb_array_elements(v_control->'cells') cell(value)
             where (cell.value->>'room_type_id')::uuid=v_room_id),false) then
          raise exception using errcode='PT409',message='hotels_v2_admin_d_capacity_below_commitments'; end if;
        if v_before is null then
          insert into public.hotel_daily_inventory(room_type_id,stay_date,sellable_units,closed,source,reason,expires_at,actor_id,sellable_units_mode,closed_mode,provenance)
          values(v_room_id,v_date,case when not (v_payload?'sellable_units_mode') or v_payload->>'sellable_units_mode'='clear' then 0 else (v_payload->>'sellable_units')::integer end,
            case when v_payload->>'closed_mode'='set' then (v_payload->>'closed')::boolean else false end,'manual',btrim(v_payload->>'reason'),
            case when v_payload->>'expires_at' is null then null else (v_payload->>'expires_at')::timestamptz end,v_actor,
            coalesce(v_payload->>'sellable_units_mode','clear'),coalesce(v_payload->>'closed_mode','clear'),jsonb_build_object('admin_d',true,'correlation_id',p_correlation_id)) returning to_jsonb(hotel_daily_inventory.*) into v_after;
          v_op_changed:=true;
        elsif (v_payload ? 'sellable_units' and (case when v_payload->>'sellable_units_mode'='clear' then v_capacity else (v_payload->>'sellable_units')::integer end) is distinct from (v_before->>'sellable_units')::integer)
          or (v_payload ? 'sellable_units_mode' and v_payload->>'sellable_units_mode' is distinct from v_before->>'sellable_units_mode')
          or (v_payload ? 'closed' and (case when v_payload->>'closed_mode'='clear' then false else (v_payload->>'closed')::boolean end) is distinct from (v_before->>'closed')::boolean)
          or (v_payload ? 'closed_mode' and v_payload->>'closed_mode' is distinct from v_before->>'closed_mode')
          or (v_payload ? 'expires_at' and v_payload->'expires_at' is distinct from v_before->'expires_at') then
          update public.hotel_daily_inventory set
            sellable_units=case when not v_payload?'sellable_units' then sellable_units when v_payload->>'sellable_units_mode'='clear' then v_capacity else (v_payload->>'sellable_units')::integer end,
            sellable_units_mode=coalesce(v_payload->>'sellable_units_mode',sellable_units_mode),
            closed=case when not v_payload?'closed' then closed when v_payload->>'closed_mode'='clear' then false else (v_payload->>'closed')::boolean end,closed_mode=coalesce(v_payload->>'closed_mode',closed_mode),
            reason=btrim(v_payload->>'reason'),expires_at=case when v_payload ? 'expires_at' then (v_payload->>'expires_at')::timestamptz else expires_at end,
            actor_id=v_actor,source='manual',provenance=jsonb_build_object('admin_d',true,'correlation_id',p_correlation_id),
            version=version+1,updated_at=clock_timestamp()
          where room_type_id=v_room_id and stay_date=v_date returning to_jsonb(hotel_daily_inventory.*) into v_after;
          v_op_changed:=true;
        end if;
      end if;
    elsif v_entity='unit_calendar_block' then
      select to_jsonb(block) into v_before from public.hotel_unit_calendar_blocks block where id=v_id and hotel_id=v_hotel_id for update;
      if coalesce((v_before->>'version')::bigint,0)<>v_expected then raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_unit_calendar_block'; end if;
      if v_action='create' then
        insert into public.hotel_unit_calendar_blocks(id,hotel_id,room_type_id,unit_id,from_date,to_date,blocked,reason,expires_at,is_active,actor_id,correlation_id)
        values(v_id,v_hotel_id,(v_payload->>'room_type_id')::uuid,(v_payload->>'unit_id')::uuid,(v_payload->>'from_date')::date,(v_payload->>'to_date')::date,
          coalesce((v_payload->>'blocked')::boolean,true),btrim(v_payload->>'reason'),(v_payload->>'expires_at')::timestamptz,coalesce((v_payload->>'is_active')::boolean,true),v_actor,p_correlation_id)
        returning to_jsonb(hotel_unit_calendar_blocks.*) into v_after; v_op_changed:=true;
      elsif v_action='disable' then
        if (v_before->>'is_active')::boolean then update public.hotel_unit_calendar_blocks set is_active=false,
          reason=btrim(v_payload->>'reason'),version=version+1,updated_at=clock_timestamp(),actor_id=v_actor,
          correlation_id=p_correlation_id where id=v_id returning to_jsonb(hotel_unit_calendar_blocks.*) into v_after;
          v_op_changed:=true; end if;
      else
        if (v_payload?'from_date' and v_payload->'from_date' is distinct from v_before->'from_date')
           or (v_payload?'to_date' and v_payload->'to_date' is distinct from v_before->'to_date')
           or (v_payload?'blocked' and v_payload->'blocked' is distinct from v_before->'blocked')
           or (v_payload?'reason' and v_payload->'reason' is distinct from v_before->'reason')
           or (v_payload?'expires_at' and v_payload->'expires_at' is distinct from v_before->'expires_at')
           or (v_payload?'is_active' and v_payload->'is_active' is distinct from v_before->'is_active') then
          update public.hotel_unit_calendar_blocks set from_date=coalesce((v_payload->>'from_date')::date,from_date),to_date=coalesce((v_payload->>'to_date')::date,to_date),blocked=coalesce((v_payload->>'blocked')::boolean,blocked),reason=coalesce(btrim(v_payload->>'reason'),reason),expires_at=case when v_payload?'expires_at' then (v_payload->>'expires_at')::timestamptz else expires_at end,is_active=coalesce((v_payload->>'is_active')::boolean,is_active),version=version+1,updated_at=clock_timestamp(),actor_id=v_actor,correlation_id=p_correlation_id where id=v_id returning to_jsonb(hotel_unit_calendar_blocks.*) into v_after;
          v_op_changed:=true;
        end if;
      end if;
    elsif v_entity='operational_override' then
      select jsonb_build_object('id',id,'room_rate_id',room_rate_id,'stay_date',stay_date,
        'availability_version',availability_version,'availability_reason',case when availability_updated_at is null then
          case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then reason end
          else availability_reason end,
        'availability_active',case when availability_updated_at is null then
          (closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null) and is_active
          else availability_active end,
        'availability_expires_at',case when availability_updated_at is null then
          case when closed_mode is not null or closed_to_arrival_mode is not null or closed_to_departure_mode is not null then expires_at end
          else availability_expires_at end,
        'closed',closed,'closed_mode',closed_mode,
        'closed_to_arrival',closed_to_arrival,'closed_to_arrival_mode',closed_to_arrival_mode,
        'closed_to_departure',closed_to_departure,'closed_to_departure_mode',closed_to_departure_mode)
        into v_before from public.hotel_calendar_overrides where id=v_id and hotel_id=v_hotel_id for update;
      if coalesce((v_before->>'availability_version')::bigint,0)<>v_expected then raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_operational_override'; end if;
      if v_action='create' then
        insert into public.hotel_calendar_overrides(id,hotel_id,room_rate_id,stay_date,closed,closed_mode,
          closed_to_arrival,closed_to_arrival_mode,closed_to_departure,closed_to_departure_mode,
          reason,actor_id,source,is_active,provenance,availability_active,availability_expires_at,
          availability_reason,availability_actor_id,availability_correlation_id,availability_updated_at)
        values(v_id,v_hotel_id,(v_payload->>'room_rate_id')::uuid,(v_payload->>'stay_date')::date,
          case when v_payload->>'closed_mode'='clear' then null else (v_payload->>'closed')::boolean end,v_payload->>'closed_mode',
          case when v_payload->>'closed_to_arrival_mode'='clear' then null else (v_payload->>'closed_to_arrival')::boolean end,v_payload->>'closed_to_arrival_mode',
          case when v_payload->>'closed_to_departure_mode'='clear' then null else (v_payload->>'closed_to_departure')::boolean end,v_payload->>'closed_to_departure_mode',
          btrim(v_payload->>'reason'),v_actor,'manual',true,jsonb_build_object('admin_d',true),
          coalesce((v_payload->>'availability_active')::boolean,true),(v_payload->>'availability_expires_at')::timestamptz,
          btrim(v_payload->>'reason'),v_actor,p_correlation_id,clock_timestamp()) returning to_jsonb(hotel_calendar_overrides.*) into v_after; v_op_changed:=true;
      elsif v_action='disable' then
        if (v_before->>'availability_active')::boolean then update public.hotel_calendar_overrides set availability_active=false,availability_reason=btrim(v_payload->>'reason'),availability_version=availability_version+1,availability_actor_id=v_actor,availability_correlation_id=p_correlation_id,availability_updated_at=clock_timestamp() where id=v_id returning to_jsonb(hotel_calendar_overrides.*) into v_after; v_op_changed:=true; end if;
      else
        if (v_payload?'closed_mode' and (v_payload->>'closed_mode' is distinct from v_before->>'closed_mode'
              or case when v_payload->>'closed_mode'='clear' then null else (v_payload->>'closed')::boolean end is distinct from (v_before->>'closed')::boolean))
           or (v_payload?'closed_to_arrival_mode' and (v_payload->>'closed_to_arrival_mode' is distinct from v_before->>'closed_to_arrival_mode'
              or case when v_payload->>'closed_to_arrival_mode'='clear' then null else (v_payload->>'closed_to_arrival')::boolean end is distinct from (v_before->>'closed_to_arrival')::boolean))
           or (v_payload?'closed_to_departure_mode' and (v_payload->>'closed_to_departure_mode' is distinct from v_before->>'closed_to_departure_mode'
              or case when v_payload->>'closed_to_departure_mode'='clear' then null else (v_payload->>'closed_to_departure')::boolean end is distinct from (v_before->>'closed_to_departure')::boolean))
           or (v_payload?'availability_active' and (v_payload->>'availability_active')::boolean is distinct from (v_before->>'availability_active')::boolean)
           or (v_payload?'availability_expires_at' and v_payload->'availability_expires_at' is distinct from v_before->'availability_expires_at') then
          update public.hotel_calendar_overrides set
          closed=case when v_payload?'closed_mode' then case when v_payload->>'closed_mode'='clear' then null else (v_payload->>'closed')::boolean end else closed end,
          closed_mode=case when v_payload?'closed_mode' then v_payload->>'closed_mode' else closed_mode end,
          closed_to_arrival=case when v_payload?'closed_to_arrival_mode' then case when v_payload->>'closed_to_arrival_mode'='clear' then null else (v_payload->>'closed_to_arrival')::boolean end else closed_to_arrival end,
          closed_to_arrival_mode=case when v_payload?'closed_to_arrival_mode' then v_payload->>'closed_to_arrival_mode' else closed_to_arrival_mode end,
          closed_to_departure=case when v_payload?'closed_to_departure_mode' then case when v_payload->>'closed_to_departure_mode'='clear' then null else (v_payload->>'closed_to_departure')::boolean end else closed_to_departure end,
          closed_to_departure_mode=case when v_payload?'closed_to_departure_mode' then v_payload->>'closed_to_departure_mode' else closed_to_departure_mode end,
          availability_active=case when v_payload?'availability_active' then (v_payload->>'availability_active')::boolean else (v_before->>'availability_active')::boolean end,
          availability_expires_at=case when v_payload?'availability_expires_at' then (v_payload->>'availability_expires_at')::timestamptz else (v_before->>'availability_expires_at')::timestamptz end,
          availability_reason=btrim(v_payload->>'reason'),availability_version=availability_version+1,
          availability_actor_id=v_actor,availability_correlation_id=p_correlation_id,availability_updated_at=clock_timestamp()
          where id=v_id returning to_jsonb(hotel_calendar_overrides.*) into v_after; v_op_changed:=true;
        end if;
      end if;
    elsif v_entity='rate_rule_operational_restriction' then
      select jsonb_build_object('id',rule.id,'room_rate_id',rule.room_rate_id,
        'valid_from',rule.valid_from,'valid_to',rule.valid_to,'weekdays',rule.weekdays,
        'priority',rule.priority,'is_active',rule.is_active,
        'closed_to_arrival',rule.closed_to_arrival,'closed_to_departure',rule.closed_to_departure,
        'availability_reason',rule.availability_reason,'availability_version',rule.availability_version) into v_before from public.hotel_rate_rules rule
        join public.hotel_room_rates rate on rate.id=rule.room_rate_id where rule.id=v_id and rate.hotel_id=v_hotel_id for update of rule;
      if (v_before->>'availability_version')::bigint<>v_expected
         or v_before is distinct from v_operation->'expected_original' then
        raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_rate_rule_restriction'; end if;
      if (v_action='clear' and ((v_before->>'closed_to_arrival')::boolean or (v_before->>'closed_to_departure')::boolean))
        or (v_action='update' and ((v_payload?'closed_to_arrival' and (v_payload->>'closed_to_arrival')::boolean is distinct from (v_before->>'closed_to_arrival')::boolean) or (v_payload?'closed_to_departure' and (v_payload->>'closed_to_departure')::boolean is distinct from (v_before->>'closed_to_departure')::boolean))) then
        update public.hotel_rate_rules set closed_to_arrival=case when v_action='clear' then false else coalesce((v_payload->>'closed_to_arrival')::boolean,closed_to_arrival) end,closed_to_departure=case when v_action='clear' then false else coalesce((v_payload->>'closed_to_departure')::boolean,closed_to_departure) end,availability_reason=btrim(v_payload->>'reason'),availability_actor_id=v_actor,availability_correlation_id=p_correlation_id,availability_updated_at=clock_timestamp(),availability_version=availability_version+1 where id=v_id returning to_jsonb(hotel_rate_rules.*) into v_after; v_op_changed:=true;
      end if;
    elsif v_entity='hold' then
      select jsonb_build_object('id',hold_row.id,'status',hold_row.status,'expires_at',hold_row.expires_at,
        'version',hold_row.version,'commitments',coalesce((select jsonb_agg(jsonb_build_object(
          'room_type_id',commitment.room_type_id,'stay_date',commitment.stay_date,'unit_id',commitment.unit_id,
          'units',commitment.units,'status',commitment.status) order by commitment.stay_date,commitment.id)
          from public.hotel_inventory_commitments commitment where commitment.hold_id=hold_row.id
            and commitment.status='active'),'[]'::jsonb)) into v_before
        from public.hotel_inventory_holds hold_row where hold_row.id=v_id and hold_row.hotel_id=v_hotel_id for update;
      if (v_before->>'version')::bigint<>v_expected or v_before is distinct from v_operation->'expected_original' then
        raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_hold'; end if;
      if v_before->>'status'='active' then update public.hotel_inventory_commitments set status='released',version=version+1,updated_at=clock_timestamp() where hold_id=v_id and status='active'; update public.hotel_inventory_holds set status='released',released_at=clock_timestamp(),release_reason=btrim(v_payload->>'reason'),version=version+1,updated_at=clock_timestamp() where id=v_id returning to_jsonb(hotel_inventory_holds.*) into v_after; v_op_changed:=true; end if;
    elsif v_entity='booking_allocation' then
      select * into v_booking from public.hotel_bookings where id=(v_payload->>'booking_id')::uuid and hotel_id=v_hotel_id for update;
      if not found then raise exception using errcode='PT404',message='hotels_v2_admin_d_booking_not_found'; end if;
      if v_action='map' and v_booking.updated_at is distinct from (v_payload->>'booking_updated_at')::timestamptz then raise exception using errcode='PT409',message='hotels_v2_admin_d_booking_stale'; end if;
      if v_action='map' and v_booking.status not in('pending','confirmed') then raise exception using errcode='23514',message='hotels_v2_admin_d_booking_mapping_required'; end if;
      select jsonb_build_object('booking_id',v_booking.id,'booking_updated_at',v_booking.updated_at,
        'arrival_date',v_booking.arrival_date,'departure_date',v_booking.departure_date,'status',v_booking.status,
        'num_adults',coalesce(v_booking.num_adults,1),'num_children',coalesce(v_booking.num_children,0),
        'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',allocation.id,
          'room_type_id',allocation.room_type_id,'rate_plan_id',allocation.rate_plan_id,
          'room_rate_id',allocation.room_rate_id,'unit_ids',allocation.unit_ids,
          'units_required',allocation.units_required,'allocated_guest_counts',allocation.allocated_guest_counts,
          'pricing_guest_counts',allocation.pricing_guest_counts) order by allocation.id)
          from public.hotel_booking_room_allocations allocation
          where allocation.booking_id=v_booking.id and allocation.status='active'),'[]'::jsonb),
        'commitments',coalesce((select jsonb_agg(jsonb_build_object('room_type_id',commitment.room_type_id,
          'stay_date',commitment.stay_date,'unit_id',commitment.unit_id,'units',commitment.units,
          'status',commitment.status) order by commitment.room_type_id,commitment.stay_date,
            commitment.unit_id nulls first,commitment.units)
          from public.hotel_inventory_commitments commitment join public.hotel_booking_room_allocations allocation
            on allocation.id=commitment.booking_allocation_id
          where allocation.booking_id=v_booking.id and allocation.status='active' and commitment.status='active'),'[]'::jsonb)) into v_before;
      if v_before is distinct from v_operation->'expected_original' then
        raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_booking_allocation'; end if;
      if v_action='release' then
        if exists(select 1 from public.hotel_booking_room_allocations where booking_id=v_booking.id and status='active') then
          update public.hotel_inventory_commitments set status='released',version=version+1,updated_at=clock_timestamp() where booking_allocation_id in(select id from public.hotel_booking_room_allocations where booking_id=v_booking.id and status='active') and status='active';
          update public.hotel_booking_room_allocations set status='released',released_at=clock_timestamp(),release_reason=btrim(v_payload->>'reason'),version=version+1,updated_at=clock_timestamp() where booking_id=v_booking.id and status='active'; v_op_changed:=true;
        end if;
      elsif v_action='map' then
        -- Preview proved semantic difference. Replace only this booking's explicit mapping; booking row remains byte-exact.
        update public.hotel_inventory_commitments set status='released',version=version+1,updated_at=clock_timestamp() where booking_allocation_id in(select id from public.hotel_booking_room_allocations where booking_id=v_booking.id and status='active') and status='active';
        update public.hotel_booking_room_allocations set status='released',released_at=clock_timestamp(),release_reason='replaced_by_reviewed_mapping',version=version+1,updated_at=clock_timestamp() where booking_id=v_booking.id and status='active';
        for v_item in select value from jsonb_array_elements(v_payload->'allocations') loop
          if not public.hotel_v2_admin_d_keys_allowed(v_item,array['id','room_type_id','rate_plan_id','room_rate_id','unit_ids','units_required','allocated_guest_counts','pricing_guest_counts']) then raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_booking_allocation'; end if;
          v_unit_ids:=array(select value::uuid from jsonb_array_elements_text(v_item->'unit_ids'));
          v_allocated:=array(select value::smallint from jsonb_array_elements_text(v_item->'allocated_guest_counts'));
          v_pricing:=array(select value::smallint from jsonb_array_elements_text(v_item->'pricing_guest_counts'));
          v_units:=(v_item->>'units_required')::integer;
          insert into public.hotel_booking_room_allocations(id,booking_id,hotel_id,room_type_id,rate_plan_id,room_rate_id,unit_ids,units_required,allocated_guest_counts,pricing_guest_counts,booking_updated_at,actor_id,correlation_id)
          values((v_item->>'id')::uuid,v_booking.id,v_hotel_id,(v_item->>'room_type_id')::uuid,(v_item->>'rate_plan_id')::uuid,(v_item->>'room_rate_id')::uuid,v_unit_ids,v_units,v_allocated,v_pricing,v_booking.updated_at,v_actor,p_correlation_id) returning * into v_allocation;
          for v_day in select generate_series(v_booking.arrival_date::timestamp,(v_booking.departure_date-1)::timestamp,interval '1 day')::date loop
            insert into public.hotel_inventory_day_locks(hotel_id,room_type_id,stay_date) values(v_hotel_id,v_allocation.room_type_id,v_day) on conflict(room_type_id,stay_date) do nothing;
            perform 1 from public.hotel_inventory_day_locks where room_type_id=v_allocation.room_type_id and stay_date=v_day for update;
            v_control:=public.hotel_v2_admin_d_snapshot_114490(v_hotel_id,v_day,v_day,false);
            if coalesce((select (cell.value->>'available_units')::integer from jsonb_array_elements(v_control->'cells') cell(value) where (cell.value->>'room_type_id')::uuid=v_allocation.room_type_id),0)<v_units then raise exception using errcode='PT409',message='hotels_v2_admin_d_insufficient_availability'; end if;
            if cardinality(v_unit_ids)=0 then insert into public.hotel_inventory_commitments(hotel_id,room_type_id,stay_date,booking_allocation_id,units) values(v_hotel_id,v_allocation.room_type_id,v_day,v_allocation.id,v_units);
            else for v_room_id in select unnest(v_unit_ids) loop insert into public.hotel_inventory_commitments(hotel_id,room_type_id,stay_date,booking_allocation_id,unit_id,units) values(v_hotel_id,v_allocation.room_type_id,v_day,v_allocation.id,v_room_id,1); end loop; end if;
          end loop;
        end loop; v_after:=jsonb_build_object('booking_id',v_booking.id,'booking_updated_at',v_booking.updated_at,
          'allocations',v_payload->'allocations'); v_op_changed:=true;
      end if;
    else raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_operation_contract'; end if;

    if v_op_changed then
      v_before:=public.hotel_v2_admin_d_audit_state(v_entity,v_before);
      v_after:=public.hotel_v2_admin_d_audit_state(v_entity,coalesce(v_after,
        case when v_entity='booking_allocation' then jsonb_build_object('booking_id',v_booking.id,
          'booking_updated_at',v_booking.updated_at,'allocations','[]'::jsonb) else null end));
      v_activity_id:=case when v_entity='daily_inventory' then public.hotel_v2_admin_d_deterministic_uuid(v_room_id::text||':'||v_date::text) else v_id end;
      v_ledger_entity:=case when v_entity='operational_override' then 'calendar_override' when v_entity='hold' then 'inventory_hold' else v_entity end;
      v_ledger_action:=case
        when v_entity='daily_inventory' and v_action='delete' then 'delete'
        when v_entity='daily_inventory' and v_action='upsert' and v_expected=0 then 'create'
        when v_action in('create','map') then 'create'
        when v_action in('disable','release','clear') then 'disable'
        else 'update' end;
      insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
      values(v_hotel_id,v_ledger_entity,v_activity_id,v_ledger_action,
        v_before,v_after,'admin',v_actor,'hotels_v2_admin_d_availability_control',p_correlation_id)
      returning id,created_at into v_activity_id,v_activity_created_at;
      v_activity:=v_activity||jsonb_build_array(jsonb_build_object('id',v_activity_id,
        'entity_type',v_ledger_entity,'entity_id',case when v_entity='daily_inventory' then public.hotel_v2_admin_d_deterministic_uuid(v_room_id::text||':'||v_date::text) else v_id end,
        'action',v_ledger_action,
        'before_state',case when v_before is null then null else jsonb_build_object('fingerprint',public.hotel_v2_admin_d_hash(v_before),'redacted',true) end,
        'after_state',case when v_after is null then null else jsonb_build_object('fingerprint',public.hotel_v2_admin_d_hash(v_after),'redacted',true) end,
        'actor_type','admin','source','hotels_v2_admin_d_availability_control',
        'correlation_id',p_correlation_id,'created_at',v_activity_created_at));
      v_changed:=true;
    end if;
  end loop;
  if jsonb_array_length(v_activity)<>jsonb_array_length(p_plan->'operations') then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_reviewed_operation_state_changed'; end if;
  v_result:=jsonb_build_object('contract_version','hotels_v2_admin_d_availability_apply_result_v1',
    'hotel_id',v_hotel_id,'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,
    'replayed',false,'changed',v_changed,'activity',v_activity,
    'availability_control',public.hotel_v2_admin_d_snapshot_114490(v_hotel_id,v_from,v_to,false));
  insert into public.hotel_admin_availability_action_receipts(actor_id,hotel_id,correlation_id,idempotency_key,request_hash,result)
  values(v_actor,v_hotel_id,p_correlation_id,p_idempotency_key,v_request_hash,v_result);
  update public.hotel_admin_availability_plan_reviews set consumed_at=clock_timestamp(),correlation_id=p_correlation_id
    where actor_id=v_actor and plan_fingerprint=v_expected_fingerprint;
  return v_result;
exception when unique_violation then
  raise exception using errcode='PT409',message='hotels_v2_admin_d_concurrent_availability_conflict';
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_preview_stay_114490(p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_hotel_id uuid; v_arrival date; v_departure date; v_pricing_request jsonb;
  v_pricing jsonb; v_pricing_control jsonb; v_control jsonb; v_rooms jsonb; v_blockers jsonb:='[]'::jsonb;
  v_available boolean:=true; v_product jsonb; v_nights jsonb; v_room_blockers jsonb;
  v_rate public.hotel_room_rates%rowtype; v_selected_room uuid; v_selected_plan uuid;
  v_units integer;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_request is null or jsonb_typeof(p_request)<>'object'
     or not public.hotel_v2_admin_d_keys_allowed(p_request,array['contract_version','hotel_id','arrival_date','departure_date',
       'adults','child_ages','room_type_id','room_rate_id','rate_plan_id','allocation_rule_id','availability_snapshot_token'])
     or p_request->>'contract_version'<>'hotels_v2_admin_d_stay_preview_request_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_request)
     or not public.hotel_v2_admin_d_json_dates_are_canonical(p_request) then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_stay_preview'; end if;
  begin v_hotel_id:=(p_request->>'hotel_id')::uuid; v_arrival:=(p_request->>'arrival_date')::date;
    v_departure:=(p_request->>'departure_date')::date;
  exception when others then raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_stay_preview'; end;
  if v_departure<=v_arrival or v_departure-v_arrival>365 then
    raise exception using errcode='22023',message='hotels_v2_admin_d_invalid_stay_preview_range'; end if;
  v_control:=public.hotel_v2_admin_d_snapshot_114490(v_hotel_id,v_arrival,v_departure,false);
  if p_request->>'availability_snapshot_token' is distinct from v_control->>'snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_admin_d_stale_availability_snapshot'; end if;
  v_selected_room:=case when p_request->>'room_type_id' is null then null else (p_request->>'room_type_id')::uuid end;
  v_selected_plan:=case when p_request->>'rate_plan_id' is null then null else (p_request->>'rate_plan_id')::uuid end;
  if p_request->>'room_rate_id' is not null then
    select * into v_rate from public.hotel_room_rates where id=(p_request->>'room_rate_id')::uuid and hotel_id=v_hotel_id;
    if not found or (v_selected_room is not null and v_selected_room<>v_rate.room_type_id)
       or (v_selected_plan is not null and v_selected_plan<>v_rate.rate_plan_id) then
      raise exception using errcode='23503',message='hotels_v2_admin_d_foreign_room_rate'; end if;
    v_selected_room:=v_rate.room_type_id; v_selected_plan:=v_rate.rate_plan_id;
  end if;
  v_pricing_control:=public.hotel_v2_admin_get_pricing_control_114490(v_hotel_id);
  v_pricing_request:=jsonb_build_object('contract_version','hotels_v2_admin_c_pricing_preview_v1',
    'hotel_id',v_hotel_id,'snapshot_token',v_pricing_control->>'snapshot_token',
    'rate_plan_id',v_selected_plan,'allocation_rule_id',p_request->'allocation_rule_id',
    'selected_room_type_id',v_selected_room,'check_in',v_arrival,'check_out',v_departure,
    'adults',p_request->'adults','child_ages',coalesce(p_request->'child_ages','[]'::jsonb));
  v_pricing:=public.hotel_v2_admin_preview_pricing_quote(v_pricing_request);
  v_rooms:='[]'::jsonb;
  for v_product in select value from jsonb_array_elements(coalesce(v_pricing->'products','[]'::jsonb))
    order by value->>'room_type_id',value->>'room_rate_id',(value->>'unit_sequence')::integer loop
    select count(*)::integer into v_units from jsonb_array_elements(coalesce(v_pricing->'products','[]'::jsonb)) sibling(value)
      where sibling.value->>'room_type_id'=v_product->>'room_type_id';
    select coalesce(jsonb_agg(cell.value||jsonb_build_object('product',(select product_cell.value
      from jsonb_array_elements(v_control->'product_cells') product_cell(value)
      where product_cell.value->>'room_rate_id'=v_product->>'room_rate_id'
        and product_cell.value->>'stay_date'=cell.value->>'stay_date' limit 1))
      order by cell.value->>'stay_date'),'[]'::jsonb) into v_nights
    from jsonb_array_elements(v_control->'cells') cell(value)
    where cell.value->>'room_type_id'=v_product->>'room_type_id' and (cell.value->>'stay_date')::date<v_departure;
    select coalesce(jsonb_agg(distinct reason.value),'[]'::jsonb) into v_room_blockers
    from jsonb_array_elements(v_nights) night(value)
    cross join lateral jsonb_array_elements_text(night.value->'blocking_reasons') reason(value);
    if jsonb_array_length(v_nights)<>(v_departure-v_arrival)
       or exists(select 1 from jsonb_array_elements(v_nights) cell(value) where (cell.value->>'available_units')::integer<v_units) then
      v_available:=false; v_room_blockers:=v_room_blockers||'["insufficient_availability"]'::jsonb;
    end if;
    if exists(select 1 from jsonb_array_elements(v_control->'product_cells') product_cell(value)
      where product_cell.value->>'room_rate_id'=v_product->>'room_rate_id' and (
        ((product_cell.value->>'stay_date')::date>=v_arrival and (product_cell.value->>'stay_date')::date<v_departure
          and ((product_cell.value->>'operational_closed')::boolean or (product_cell.value->>'safety_closed')::boolean))
        or ((product_cell.value->>'stay_date')::date=v_arrival and (product_cell.value->>'closed_to_arrival')::boolean)
        or ((product_cell.value->>'stay_date')::date=v_departure and (product_cell.value->>'closed_to_departure')::boolean))) then
      v_available:=false; v_room_blockers:=v_room_blockers||'["product_restriction_blocked"]'::jsonb;
    end if;
    select coalesce(jsonb_agg(value order by value),'[]'::jsonb) into v_room_blockers
      from(select distinct value from jsonb_array_elements_text(v_room_blockers) reason(value)) unique_reason;
    v_rooms:=v_rooms||jsonb_build_array(jsonb_build_object('room_type_id',v_product->'room_type_id',
      'room_rate_id',v_product->'room_rate_id','rate_plan_id',v_product->'rate_plan_id',
      'unit_sequence',v_product->'unit_sequence',
      'nights',v_nights,'departure_boundary_product',(select product_cell.value
        from jsonb_array_elements(v_control->'product_cells') product_cell(value)
        where product_cell.value->>'room_rate_id'=v_product->>'room_rate_id'
          and (product_cell.value->>'stay_date')::date=v_departure limit 1),
      'requestable',false,'blocking_reasons',v_room_blockers));
  end loop;
  if exists(select 1 from jsonb_array_elements(v_control->'unmapped_booking_blockers') blocker(value)
    where (blocker.value->>'arrival_date')::date<v_departure
      and (blocker.value->>'departure_date')::date>v_arrival) then
    v_available:=false; v_blockers:=v_blockers||'["unmapped_bookings_require_allocation"]'::jsonb; end if;
  if not coalesce((v_pricing->>'ok')::boolean,false) then v_available:=false;
    v_blockers:=v_blockers||'["pricing_configuration_blocked"]'::jsonb; end if;
  if not v_available then v_blockers:=v_blockers||'["insufficient_availability"]'::jsonb; end if;
  v_blockers:=v_blockers||'["public_activation_off"]'::jsonb;
  select coalesce(jsonb_agg(value order by value),'[]'::jsonb) into v_blockers
    from(select distinct value from jsonb_array_elements_text(v_blockers) reason(value)) unique_reason;
  return jsonb_build_object('contract_version','hotels_v2_admin_d_available_stay_preview_v1',
    'hotel_id',v_hotel_id,'pricing',v_pricing,'availability',jsonb_build_object(
      'snapshot_token',v_control->>'snapshot_token','rooms',v_rooms,
      'requested_units',jsonb_array_length(coalesce(v_pricing->'products','[]'::jsonb)),
      'available_for_stay',v_available),'ok',coalesce((v_pricing->>'ok')::boolean,false) and v_available,
    'requestable',false,'blocking_reasons',v_blockers,
    'configuration_fingerprint',public.hotel_v2_admin_d_hash(jsonb_build_object(
      'pricing',v_pricing->>'snapshot_token','availability',v_control->>'snapshot_token')),
    'public_change',false);
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_external_calendar_site_settings_fingerprint_114490()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_setting public.site_settings%rowtype;
  v_receipt hotels_v2_private.hotel_external_calendar_activation_receipts%rowtype;
begin
  if to_regprocedure('public.hotel_v2_external_calendar_worker_hash(jsonb)') is null
     or to_regprocedure(
       'public.hotel_v2_external_calendar_activation_function_fingerprints()') is null
     or to_regprocedure(
       'public.hotel_v2_partner_workspace_function_lineage_is_exact()') is null
     or to_regprocedure('public.hotel_v2_h3_2a_reject_immutable_change()') is null
     or (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1)
     or (select count(*)
       from hotels_v2_private.hotel_external_calendar_activation_receipts)<>1
     or not exists(select 1
       from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1) then
    return null;
  end if;

  select * into strict v_setting from public.site_settings where id=1;
  select * into strict v_receipt
  from hotels_v2_private.hotel_external_calendar_activation_receipts where id=1;

  -- OFF and ON are the two supported external-calendar states. The other
  -- Hotels flags stay on the legacy production boundary in both states.
  if v_setting.id is distinct from 1
     or not hotels_post_114489_private.predecessor_flag_exact_114490('hotel_rooms_v2_enabled',v_setting.hotel_rooms_v2_enabled)
     or (v_setting.hotel_external_sync_enabled is distinct from false
       and v_setting.hotel_external_sync_enabled is distinct from true)
     or v_setting.hotel_instant_booking_enabled is distinct from false
     or not hotels_post_114489_private.predecessor_flag_exact_114490('hotel_stripe_connect_enabled',v_setting.hotel_stripe_connect_enabled) then
    return null;
  end if;

  -- The 114350 row has no self-hash column, so historical integrity is its
  -- exact constrained envelope plus its immutable/private security topology.
  if v_receipt.id is distinct from 1
     or (v_receipt.site_settings_without_external_fingerprint
       ~'^[0-9a-f]{64}$') is distinct from true
     or jsonb_typeof(v_receipt.compatibility_function_fingerprints)
       is distinct from 'object'
     or v_receipt.created_at is null
     or isfinite(v_receipt.created_at) is distinct from true then
    return null;
  end if;
  -- Keep malformed non-object JSON away from the set-returning object
  -- iterators above all other receipt checks.
  if (select count(*) from jsonb_object_keys(
       v_receipt.compatibility_function_fingerprints))<>20
     or (v_receipt.compatibility_function_fingerprints ?& array[
       'public.hotel_v2_h3_2a_require_partner_hotel_access(uuid,uuid,text,boolean)',
       'public.hotel_v2_partner_list_assigned_properties(uuid)',
       'public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)',
       'public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)',
       'public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)',
       'public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)',
       'public.hotel_v2_admin_get_content_control(uuid)',
       'public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)',
       'public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)',
       'public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)',
       'public.hotel_v2_admin_apply_h3_1_configuration_h3_1p_core(jsonb,uuid)',
       'public.hotel_v2_h3_2b_flags_off()',
       'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',
       'public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)',
       'public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)',
       'public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)',
       'public.hotel_v2_admin_apply_calendar_plan_admin_c_core(jsonb,uuid)',
       'public.hotel_v2_admin_apply_workspace_plan_admin_c_core(jsonb,uuid)',
       'public.hotel_v2_admin_apply_h3_1_configuration_admin_c_core(jsonb,uuid)',
       'public.hotel_v2_admin_apply_legacy_pricing_promotion_admin_c_core(jsonb,uuid)'
     ]::text[]) is distinct from true
     or exists(select 1 from jsonb_each_text(
       v_receipt.compatibility_function_fingerprints) fingerprint(signature,value)
       where (fingerprint.value~'^[0-9a-f]{64}$') is distinct from true)
     or not exists(select 1 from pg_class relation
       where relation.oid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and relation.relowner='postgres'::regrole)
     or (select count(*) from pg_attribute attribute
       where attribute.attrelid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and attribute.attnum>0 and not attribute.attisdropped)<>4
     or exists(select 1 from (values
        (1::smallint,'id','smallint',true,null::text),
        (2::smallint,'site_settings_without_external_fingerprint','text',true,null::text),
        (3::smallint,'compatibility_function_fingerprints','jsonb',true,null::text),
        (4::smallint,'created_at','timestamp with time zone',true,'clock_timestamp()')
       ) expected(attnum,attname,type_name,not_null,default_expression)
       left join pg_attribute attribute on attribute.attrelid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and attribute.attnum=expected.attnum and not attribute.attisdropped
       left join pg_attrdef default_row on default_row.adrelid=attribute.attrelid
         and default_row.adnum=attribute.attnum
       where attribute.attrelid is null
         or attribute.attname is distinct from expected.attname
         or format_type(attribute.atttypid,attribute.atttypmod)
           is distinct from expected.type_name
         or attribute.attnotnull is distinct from expected.not_null
         or attribute.attidentity is distinct from ''
         or attribute.attgenerated is distinct from ''
         or pg_get_expr(default_row.adbin,default_row.adrelid)
           is distinct from expected.default_expression)
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)<>4
     or (select count(*) from pg_constraint constraint_row
       join pg_index index_row on index_row.indexrelid=constraint_row.conindid
       where constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='p' and constraint_row.convalidated
         and constraint_row.conkey=array[1]::smallint[]
         and pg_get_constraintdef(constraint_row.oid)='PRIMARY KEY (id)'
         and index_row.indisprimary and index_row.indisunique
         and index_row.indisvalid and index_row.indisready)<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[1]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')='(id=1)')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[2]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')=
           '(site_settings_without_external_fingerprint~''^[0-9a-f]{64}$''::text)')<>1
     or (select count(*) from pg_constraint constraint_row where
       constraint_row.conrelid=
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and constraint_row.contype='c' and constraint_row.convalidated
         and not constraint_row.connoinherit
         and constraint_row.conkey=array[3]::smallint[]
         and regexp_replace(pg_get_expr(constraint_row.conbin,constraint_row.conrelid),
           '[[:space:]]+','','g')=
           '(jsonb_typeof(compatibility_function_fingerprints)=''object''::text)')<>1
     or exists(select 1 from pg_policy policy where policy.polrelid=
       'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass)
     or not exists(select 1 from pg_trigger trigger_row
       where trigger_row.tgrelid=
         'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass
         and trigger_row.tgname='hotel_external_calendar_activation_receipt_immutable'
         and trigger_row.tgfoid=
           'public.hotel_v2_h3_2a_reject_immutable_change()'::regprocedure
         and trigger_row.tgtype=27 and not trigger_row.tgisinternal
         and trigger_row.tgenabled='O')
     or exists(select 1
       from unnest(array[
         'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
       ]) privilege(name)
       where has_table_privilege(0::oid,
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
           privilege.name)
         or has_table_privilege('anon',
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
           privilege.name)
         or has_table_privilege('authenticated',
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
           privilege.name)
         or has_table_privilege('service_role',
           'hotels_v2_private.hotel_external_calendar_activation_receipts'::regclass,
           privilege.name))
     or not exists(select 1 from pg_namespace namespace_row
       where namespace_row.oid='hotels_v2_private'::regnamespace
         and namespace_row.nspowner='postgres'::regrole)
     or has_schema_privilege(0::oid,'hotels_v2_private','USAGE')
     or has_schema_privilege('anon','hotels_v2_private','USAGE')
     or has_schema_privilege('service_role','hotels_v2_private','USAGE')
     or has_schema_privilege(0::oid,'hotels_v2_private','CREATE')
     or has_schema_privilege('anon','hotels_v2_private','CREATE')
     or has_schema_privilege('authenticated','hotels_v2_private','CREATE')
     or has_schema_privilege('service_role','hotels_v2_private','CREATE') then
    return null;
  end if;

  -- Pin the hash, receipt projection, accepted Task2 lineage validator, this
  -- seam itself, and the immutable trigger to their private security shapes.
  if exists(select 1 from (values
      ('public.hotel_v2_external_calendar_worker_hash(jsonb)',true,
        array['search_path=pg_catalog']::text[],
        'd60c1f7509fa64b84e52ea9b7cd06d69f295044e76fd450cafda81528c96a828'),
      ('public.hotel_v2_external_calendar_activation_function_fingerprints()',true,
        array['search_path=pg_catalog, public']::text[],
        'fa6ae9122ad73f57be91c611177eb562b90b09ca9620b98d9f494abafcf3a914'),
      ('public.hotel_v2_partner_workspace_function_lineage_is_exact()',true,
        array['search_path=pg_catalog, public']::text[],
        'dde4fac2d044a53bb713cced26ca93c8295548c9bde3717d0ea83dc511801a85'),
      ('public.hotel_v2_h3_2a_reject_immutable_change()',false,
        array['search_path=pg_catalog, public']::text[],
        '5ab5f8fec4515a0eb0e4da1a4de9f765618f45feb0dfe581e0f2a0e9d0a9ef6c'),
      ('public.hotel_v2_external_calendar_site_settings_fingerprint()',true,
        array['search_path=pg_catalog, public']::text[],null::text)
    ) expected(signature,security_definer,path,source_hash)
    left join pg_proc procedure_row
      on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null
      or procedure_row.proowner<>'postgres'::regrole
      or procedure_row.prosecdef is distinct from expected.security_definer
      or procedure_row.proconfig is distinct from expected.path
      or (expected.source_hash is not null and encode(extensions.digest(
        convert_to(hotels_lifecycle_private.predecessor_source(procedure_row.oid),'UTF8'),'sha256'),'hex')
          is distinct from expected.source_hash)
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')) then
    return null;
  end if;

  -- The receipt is readiness evidence in the OFF state and activation lineage
  -- in the ON state. Frozen compatibility functions must be exact in both.
  if public.hotel_v2_partner_workspace_function_lineage_is_exact()
       is distinct from true then
    return null;
  end if;

  -- Excluding the current ON/OFF value makes this a stable two-state seam.
  -- No mutable non-Hotels site_settings field enters the canonical value.
  return public.hotel_v2_external_calendar_worker_hash(jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_site_settings_lifecycle_v2',
    'id',1,
    'hotel_rooms_v2_enabled',false,
    'hotel_external_sync_enabled_supported_values',jsonb_build_array(false,true),
    'hotel_instant_booking_enabled',false,
    'hotel_stripe_connect_enabled',false));
exception when no_data_found or too_many_rows or undefined_function
  or undefined_table or invalid_schema_name then
  return null;
end
$function$;


CREATE OR REPLACE FUNCTION hotels_post_114489_private.calendar_scheduler_ready_114490()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v_job_count integer:=0;
begin
  if to_regclass('cron.job') is null then return false; end if;
  execute $sql$select count(*) from cron.job
    where jobname='hotels-v2-external-calendar-15m'
      and schedule='*/15 * * * *' and active
      and command='select public.hotel_v2_external_calendar_scheduler_dispatch()'$sql$
    into v_job_count;
  return v_job_count=1
    and (select count(*) from vault.decrypted_secrets
      where name='hotels-v2-external-calendar-worker-url'
        and decrypted_secret=
          'https://daoohnbnnowmmcizgvrq.functions.supabase.co/hotels-v2-external-calendar-sync')=1
    and (select count(*) from vault.decrypted_secrets
      where name='hotels-v2-external-calendar-worker-shared-secret'
        and length(decrypted_secret)>=32
        and decrypted_secret!~'[[:space:][:cntrl:]]')=1
    and hotels_post_114489_private.calendar_provider_lineage_bridge_114490();
exception when undefined_table or undefined_function or invalid_schema_name then
  return false;
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_external_calendar_control_common_114490(p_actor_type text, p_partner_id uuid, p_hotel_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare v_assignment uuid; v_permission bigint; v_access text; v_partner_access jsonb;
  v_sources jsonb; v_token text;
begin
  if p_hotel_id is null or not exists(select 1 from public.hotels hotel where hotel.id=p_hotel_id
      and hotel.architecture_version IN ('legacy','rooms_v2')) then
    raise exception using errcode='PT404',message='hotels_v2_external_calendar_hotel_not_found';
  end if;
  if p_actor_type='admin' then perform public.hotel_v2_h2a_require_admin();
  elsif p_actor_type='partner' then
    v_partner_access:=public.hotel_v2_h3_2b_access_snapshot(
      p_partner_id,p_hotel_id,'manage_availability');
    v_assignment:=(v_partner_access->>'assignment_id')::uuid;
    v_permission:=(v_partner_access->>'permission_version')::bigint;
    v_access:=public.hotel_v2_external_calendar_worker_hash(v_partner_access);
  else raise exception using errcode='42501',message='hotels_v2_external_calendar_access_denied'; end if;
  if (select count(*) from public.site_settings)<>1 then
    raise exception using errcode='55000',message='hotels_v2_external_calendar_settings_cardinality'; end if;
  if (select count(*) from public.hotel_room_types room where room.hotel_id=p_hotel_id)>1000
     or (select count(*) from public.hotel_calendar_source_configs source
       where source.hotel_id=p_hotel_id and public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type))>5000
     or (select count(*) from hotels_v2_private.hotel_external_calendar_day_blocks block
       join public.hotel_calendar_source_configs source on source.id=block.source_id
       where block.hotel_id=p_hotel_id and block.is_active and public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)
         and source.is_enabled and source.review_status='reviewed')>310000 then
    raise exception using errcode='54000',message='hotels_v2_external_calendar_control_limit_exceeded'; end if;
  select coalesce(jsonb_agg(public.hotel_v2_external_calendar_source_projection(source.id)
    order by source.room_type_id,source.priority desc,source.code,source.id),'[]'::jsonb)
    into v_sources from public.hotel_calendar_source_configs source
    where source.hotel_id=p_hotel_id and public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type);
  v_token:=public.hotel_v2_external_calendar_worker_hash(jsonb_build_object('hotel_id',p_hotel_id,
    'hotel_external_sync_enabled',(select hotel_external_sync_enabled from public.site_settings where id=1),
    'rooms',coalesce((select jsonb_agg(jsonb_build_array(room.id,room.status,room.version)
      order by room.id) from public.hotel_room_types room where room.hotel_id=p_hotel_id),'[]'::jsonb),
    'sources',coalesce((select jsonb_agg(jsonb_build_array(source.id,source.room_type_id,
      source.code,source.source_type,source.configuration,source.is_enabled,source.review_status,
      source.priority,source.version,source.updated_at,binding.version,binding.url_fingerprint)
      order by source.id) from public.hotel_calendar_source_configs source
      left join hotels_v2_private.hotel_external_calendar_source_secrets binding on binding.source_id=source.id
      where source.hotel_id=p_hotel_id and public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type)),'[]'::jsonb),
    'effective_external_blocks',coalesce((select jsonb_agg(jsonb_build_array(
      effective.room_type_id,effective.stay_date,effective.units_blocked)
      order by effective.room_type_id,effective.stay_date) from(
        select block.room_type_id,block.stay_date,least(sum(block.units_blocked)::integer,
          case when room.inventory_mode='unitized' then (select count(*)::integer
            from public.hotel_units unit where unit.room_type_id=room.id and unit.status='active')
          else room.base_inventory_count end) units_blocked
        from hotels_v2_private.hotel_external_calendar_day_blocks block
        join public.hotel_calendar_source_configs source on source.id=block.source_id
          and source.hotel_id=block.hotel_id and source.room_type_id=block.room_type_id
          and public.hotel_v2_external_calendar_ics_source_type_is_supported(source.source_type) and source.is_enabled and source.review_status='reviewed'
        join public.hotel_room_types room on room.id=block.room_type_id and room.hotel_id=block.hotel_id
        where block.hotel_id=p_hotel_id and block.is_active
        group by block.room_type_id,block.stay_date,room.id,room.inventory_mode,room.base_inventory_count
      ) effective),'[]'::jsonb)));
  return jsonb_build_object('contract_version','hotels_v2_external_calendar_control_v2',
    'hotel_id',p_hotel_id,'partner_id',p_partner_id,'assignment_id',v_assignment,
    'permission_version',v_permission,'access_snapshot_token',v_access,'snapshot_token',v_token,
    'hotel_external_sync_enabled',(select hotel_external_sync_enabled from public.site_settings where id=1),
    'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',room.id,'name_i18n',room.name_i18n,
      'status',room.status,'version',room.version) order by room.sort_order,room.id)
      from public.hotel_room_types room where room.hotel_id=p_hotel_id),'[]'::jsonb),
    'sources',v_sources,
    'provider_capability',jsonb_build_object(
      'contract_version','hotels_v2_external_calendar_provider_capability_v1',
      'stage','provider_types_active',
      'supported_providers',jsonb_build_array('booking_com','airbnb','ical'),
      'source_review_available',true,'private_url_management_available',true,
      'activation_available',coalesce((select hotel_external_sync_enabled
        from public.site_settings where id=1),false)
        and hotels_post_114489_private.calendar_scheduler_ready_114490(),
      'manual_sync_available',coalesce((select hotel_external_sync_enabled
        from public.site_settings where id=1),false)
        and hotels_post_114489_private.calendar_scheduler_ready_114490(),
      'worker_scheduler_ready',
        hotels_post_114489_private.calendar_scheduler_ready_114490()),
    'provider_proposals',coalesce((select jsonb_agg(
      case when p_actor_type='partner' then jsonb_set(
        hotels_v2_private.hotel_external_calendar_provider_proposal_summary(proposal.id),
        '{reviewed_by}','null'::jsonb,false)
      else hotels_v2_private.hotel_external_calendar_provider_proposal_summary(proposal.id) end
      order by proposal.submitted_at desc,proposal.id)
      from (select candidate.id,candidate.submitted_at
        from hotels_v2_private.hotel_external_calendar_partner_proposals candidate
        where candidate.hotel_id=p_hotel_id
          and (p_actor_type='admin' or candidate.partner_id=p_partner_id)
        order by candidate.submitted_at desc,candidate.id limit 100) proposal),'[]'::jsonb),
    'public_change',false);
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_external_calendar_preview_common_114490(p_actor_type text, p_draft jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare v_actor uuid:=auth.uid(); v_hotel uuid; v_partner uuid; v_control jsonb; v_intent jsonb;
  v_entity text; v_action text; v_id uuid; v_expected bigint; v_payload jsonb; v_reason text;
  v_original jsonb; v_after jsonb; v_operation jsonb; v_impact jsonb; v_plan jsonb;
  v_review uuid:=gen_random_uuid(); v_reviewed timestamptz:=clock_timestamp();
  v_expires timestamptz:=clock_timestamp()+interval '30 minutes'; v_fingerprint text;
  v_changed boolean:=true; v_source public.hotel_calendar_source_configs%rowtype;
  v_url_fingerprint text; v_fields jsonb; v_access text; v_assignment uuid; v_permission bigint;
  v_impact_before jsonb; v_impact_after jsonb;
begin
  if v_actor is null or p_draft is null or jsonb_typeof(p_draft)<>'object'
     or not public.hotel_v2_h2a_keys_allowed(p_draft,array['contract_version','hotel_id','partner_id',
       'assignment_id','permission_version','access_snapshot_token','snapshot_token','intent'])
     or not (p_draft?&array['contract_version','hotel_id','partner_id','assignment_id',
       'permission_version','access_snapshot_token','snapshot_token','intent'])
     or p_draft->>'contract_version'<>'hotels_v2_external_calendar_draft_v1'
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_draft)
     or jsonb_typeof(p_draft->'intent')<>'object' then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_draft'; end if;
  v_hotel:=(p_draft->>'hotel_id')::uuid;
  v_partner:=case when p_draft->>'partner_id' is null then null else (p_draft->>'partner_id')::uuid end;
  v_control:=public.hotel_v2_external_calendar_control_common_114490(p_actor_type,v_partner,v_hotel);
  if p_draft->>'snapshot_token' is distinct from v_control->>'snapshot_token'
     or p_draft->'partner_id' is distinct from v_control->'partner_id'
     or p_draft->'assignment_id' is distinct from v_control->'assignment_id'
     or p_draft->'permission_version' is distinct from v_control->'permission_version'
     or p_draft->'access_snapshot_token' is distinct from v_control->'access_snapshot_token' then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_stale_snapshot'; end if;
  v_assignment:=case when v_control->>'assignment_id' is null then null else (v_control->>'assignment_id')::uuid end;
  v_permission:=case when v_control->>'permission_version' is null then null else (v_control->>'permission_version')::bigint end;
  v_access:=v_control->>'access_snapshot_token'; v_intent:=p_draft->'intent';
  if not public.hotel_v2_h2a_keys_allowed(v_intent,array['entity','action','id','expected_version','payload','reason'])
     or not (v_intent?&array['entity','action','id','expected_version','payload','reason'])
     or not public.hotel_v2_external_calendar_reason_valid(v_intent->'reason')
     or jsonb_typeof(v_intent->'payload')<>'object' then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_intent'; end if;
  v_entity:=v_intent->>'entity';v_action:=v_intent->>'action';
  v_id:=case when v_intent->>'id' is null then null else (v_intent->>'id')::uuid end;
  if jsonb_typeof(v_intent->'expected_version')<>'number'
     or v_intent->>'expected_version'!~'^(0|[1-9][0-9]*)$' then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_expected_version'; end if;
  v_expected:=(v_intent->>'expected_version')::bigint;v_payload:=v_intent->'payload';v_reason:=v_intent->>'reason';
  if v_entity='calendar_source' and v_action='create' then
    if v_id is null then
      v_id:=gen_random_uuid();
    elsif p_actor_type<>'admin'
       or nullif(current_setting('hotels_v2.external_calendar_provider_proposal_id',true),'') is null
       or not exists(select 1
         from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
         where proposal.id=current_setting(
             'hotels_v2.external_calendar_provider_proposal_id',true)::uuid
           and proposal.hotel_id=v_hotel and proposal.status='pending_admin_review'
           and proposal.entity='calendar_source' and proposal.action='create'
           and proposal.source_id=v_id
           and proposal.operation->>'expected_version'=v_intent->>'expected_version'
           and proposal.operation->'payload' is not distinct from v_intent->'payload') then
      raise exception using errcode='22023',
        message='hotels_v2_external_calendar_create_id_must_be_null';
    end if;
  elsif v_id is null then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_target_id_required';
  end if;

  if v_entity='calendar_source' and v_action in('create','update') then
    if not public.hotel_v2_h2a_keys_allowed(v_payload,array['room_type_id','code','source_type','sync_interval_minutes','units_per_event','priority'])
       or not (v_payload?&array['room_type_id','code','source_type','sync_interval_minutes','units_per_event','priority'])
       or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(v_payload)
       or jsonb_typeof(v_payload->'source_type')<>'string'
       or not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_payload->>'source_type')
       or jsonb_typeof(v_payload->'code')<>'string' or v_payload->>'code'!~'^[a-z0-9][a-z0-9_-]{0,79}$'
       or jsonb_typeof(v_payload->'sync_interval_minutes')<>'number'
       or v_payload->>'sync_interval_minutes'!~'^[1-9][0-9]*$'
       or (v_payload->>'sync_interval_minutes')::integer not between 15 and 1440
       or jsonb_typeof(v_payload->'units_per_event')<>'number'
       or v_payload->>'units_per_event'!~'^[1-9][0-9]*$'
       or (v_payload->>'units_per_event')::integer not between 1 and 100
       or jsonb_typeof(v_payload->'priority')<>'number' or v_payload->>'priority'!~'^-?[0-9]+$'
       or (v_payload->>'priority')::integer not between -32768 and 32767
       or not exists(select 1 from public.hotel_room_types room
         where room.id=(v_payload->>'room_type_id')::uuid and room.hotel_id=v_hotel and room.status='active'
           and (v_payload->>'units_per_event')::integer<=case when room.inventory_mode='unitized'
             then (select count(*)::integer from public.hotel_units unit
               where unit.room_type_id=room.id and unit.status='active') else room.base_inventory_count end) then
      raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_source_payload'; end if;
    select * into v_source from public.hotel_calendar_source_configs where id=v_id and hotel_id=v_hotel;
    if v_action='create' then
      if found or v_expected<>0 then raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_exists'; end if;
      if exists(select 1 from public.hotel_calendar_source_configs where hotel_id=v_hotel and code=v_payload->>'code') then
        raise exception using errcode='23505',message='hotels_v2_external_calendar_source_code_conflict'; end if;
      v_original:=null;
      v_after:=jsonb_build_object('id',v_id,'hotel_id',v_hotel,'room_type_id',v_payload->'room_type_id',
        'code',v_payload->'code','source_type',v_payload->'source_type','is_enabled',false,'review_status','reviewed',
        'priority',v_payload->'priority','version',1,'secret_configured',false,'binding_version',null,
        'sync_interval_minutes',v_payload->'sync_interval_minutes','units_per_event',v_payload->'units_per_event');
    else
      if not found or not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type) then raise exception using errcode='PT404',message='hotels_v2_external_calendar_source_not_found'; end if;
      if exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
          where job.source_id=v_id and job.status in('queued','leased','running')) then
        raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_sync_in_progress'; end if;
      if v_source.version<>v_expected then
        raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_stale'; end if;
      if (v_source.room_type_id<>(v_payload->>'room_type_id')::uuid or v_source.source_type<>v_payload->>'source_type') and (v_source.is_enabled
         or exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_id)
         or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_runs where source_id=v_id)
         or exists(select 1 from hotels_v2_private.hotel_external_calendar_events where source_id=v_id)) then
        raise exception using errcode='23514',message='hotels_v2_external_calendar_source_mapping_not_changeable'; end if;
      v_original:=public.hotel_v2_external_calendar_source_projection(v_id);
      v_after:=v_original||jsonb_build_object('room_type_id',v_payload->'room_type_id',
        'code',v_payload->'code','source_type',v_payload->'source_type','priority',v_payload->'priority',
        'sync_interval_minutes',v_payload->'sync_interval_minutes','units_per_event',v_payload->'units_per_event',
        'version',v_expected+1);
      v_changed:=v_source.room_type_id<>(v_payload->>'room_type_id')::uuid
        or v_source.source_type<>v_payload->>'source_type' or v_source.code<>v_payload->>'code' or v_source.priority<>(v_payload->>'priority')::smallint
        or coalesce((v_source.configuration->>'sync_interval_minutes')::integer,60)<>(v_payload->>'sync_interval_minutes')::integer
        or coalesce((v_source.configuration->>'units_per_event')::integer,1)<>(v_payload->>'units_per_event')::integer;
    end if;
  elsif v_entity='calendar_source' and v_action in('enable','disable') then
    if v_payload<>'{}'::jsonb then raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_source_payload'; end if;
    select * into v_source from public.hotel_calendar_source_configs where id=v_id and hotel_id=v_hotel;
    if not found or not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type) then raise exception using errcode='PT404',message='hotels_v2_external_calendar_source_not_found'; end if;
    if exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
        where job.source_id=v_id and job.status in('queued','leased','running')) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_sync_in_progress'; end if;
    if v_source.version<>v_expected then raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_stale'; end if;
    v_original:=public.hotel_v2_external_calendar_source_projection(v_id);
    if v_action='enable' then
      if not (v_control->>'hotel_external_sync_enabled')::boolean
         or not hotels_post_114489_private.calendar_scheduler_ready_114490() then
        return jsonb_build_object('contract_version','hotels_v2_external_calendar_preview_v1',
          'hotel_id',v_hotel,'partner_id',v_partner,'changed',false,
          'blocking_reasons',case
            when not (v_control->>'hotel_external_sync_enabled')::boolean
              then '["external_calendar_not_activated"]'::jsonb
            else '["provider_worker_scheduler_not_ready"]'::jsonb end,
          'impacts','[]'::jsonb,'reviewed_plan',null);
      end if;
      if not exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_id) then
        raise exception using errcode='23514',message='hotels_v2_external_calendar_secret_required'; end if;
      if exists(select 1 from public.hotel_calendar_source_configs other where other.hotel_id=v_hotel
          and other.room_type_id=v_source.room_type_id and other.is_enabled and other.id<>v_id) then
        raise exception using errcode='23505',message='hotels_v2_external_calendar_room_source_conflict'; end if;
      v_changed:=not v_source.is_enabled; v_after:=v_original||jsonb_build_object('is_enabled',true,'version',v_expected+1);
    else v_changed:=v_source.is_enabled; v_after:=v_original||jsonb_build_object('is_enabled',false,'version',v_expected+1); end if;
  elsif v_entity='ical_secret' and v_action in('set','rotate','clear') then
    if (v_action in('set','rotate') and (not public.hotel_v2_h2a_keys_allowed(v_payload,array['source_id','ical_url'])
       or not (v_payload?&array['source_id','ical_url']) or (v_payload->>'source_id')::uuid<>v_id
       or jsonb_typeof(v_payload->'ical_url')<>'string' or length(btrim(v_payload->>'ical_url')) not between 12 and 4096
       or btrim(v_payload->>'ical_url')!~'^https://[^/?#[:space:][:cntrl:]@]+([/?#].*)?$'))
       or (v_action='clear' and (v_payload<>jsonb_build_object('source_id',v_id))) then
      raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_secret_payload'; end if;
    select * into v_source from public.hotel_calendar_source_configs where id=v_id and hotel_id=v_hotel;
    if not found or not public.hotel_v2_external_calendar_ics_source_type_is_supported(v_source.source_type) or v_source.is_enabled then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_secret_source_stale'; end if;
    if exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
        where job.source_id=v_id and job.status in('queued','leased','running')) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_sync_in_progress'; end if;
    v_original:=jsonb_build_object('secret_configured',exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_id),
      'binding_version',(select version from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_id));
    if v_expected<>coalesce((v_original->>'binding_version')::bigint,0) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_binding_stale'; end if;
    if v_action='set' and (v_original->>'secret_configured')::boolean
       or v_action in('rotate','clear') and not (v_original->>'secret_configured')::boolean then
      raise exception using errcode='23514',message='hotels_v2_external_calendar_secret_action_mismatch'; end if;
    if v_action='clear' then
      v_payload:=jsonb_build_object('source_id',v_id,'secret_configured',false);
      v_after:=jsonb_build_object('secret_configured',false,'binding_version',null);
    else
      v_url_fingerprint:=encode(extensions.digest(convert_to(btrim(v_payload->>'ical_url'),'UTF8'),'sha256'),'hex');
      v_payload:=jsonb_build_object('source_id',v_id,'url_fingerprint',v_url_fingerprint,'secret_configured',true);
      v_after:=jsonb_build_object('secret_configured',true,'binding_version',coalesce((v_original->>'binding_version')::bigint,0)+1);
    end if;
  elsif v_entity='calendar_sync' and v_action='trigger' then
    if not public.hotel_v2_h2a_keys_allowed(v_payload,array['source_id'])
       or not (v_payload?&array['source_id']) or (v_payload->>'source_id')::uuid<>v_id then
      raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_trigger_payload'; end if;
    select * into v_source from public.hotel_calendar_source_configs where id=v_id and hotel_id=v_hotel;
    if not found
       or not public.hotel_v2_external_calendar_ics_source_type_is_supported(
         v_source.source_type) or not v_source.is_enabled
       or not (v_control->>'hotel_external_sync_enabled')::boolean
       or not hotels_post_114489_private.calendar_scheduler_ready_114490() then
      raise exception using errcode='23514',message='hotels_v2_external_calendar_source_not_triggerable'; end if;
    if exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
        where job.source_id=v_id and job.status in('queued','leased','running')) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_sync_already_queued'; end if;
    v_original:=public.hotel_v2_external_calendar_source_projection(v_id);
    if v_expected<>coalesce((v_original#>>'{health,state_version}')::bigint,0) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_state_stale'; end if;
    v_after:=jsonb_build_object('queued',true);
  else raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_operation'; end if;

  if not v_changed then return jsonb_build_object('contract_version','hotels_v2_external_calendar_preview_v1',
    'hotel_id',v_hotel,'partner_id',v_partner,'changed',false,'blocking_reasons','[]'::jsonb,
    'impacts','[]'::jsonb,'reviewed_plan',null); end if;
  v_fields:=case when v_entity='calendar_source' and v_action in('create','update')
      then '["code","priority","room_type_id","source_type","sync_interval_minutes","units_per_event"]'::jsonb
    when v_entity='calendar_source' then '["is_enabled"]'::jsonb
    when v_entity='ical_secret' then '["secret_configured"]'::jsonb
    else '["queued"]'::jsonb end;
  select case when v_original is null then null else coalesce(jsonb_object_agg(field.value,
      case when field.value='queued' then 'false'::jsonb else v_original->field.value end
      order by field.value),'{}'::jsonb) end into v_impact_before
    from jsonb_array_elements_text(v_fields) field(value);
  select coalesce(jsonb_object_agg(field.value,v_after->field.value order by field.value),'{}'::jsonb)
    into v_impact_after from jsonb_array_elements_text(v_fields) field(value);
  v_operation:=jsonb_build_object('entity',v_entity,'action',v_action,'id',v_id,
    'expected_version',v_expected,'expected_original',v_original,'payload',v_payload,'reason',v_reason);
  v_impact:=jsonb_build_object('entity',v_entity,'action',v_action,'id',v_id,'changed',true,
    'fields',v_fields,'before',v_impact_before,'after',v_impact_after,
    'affected_room_type_ids',case
      when v_entity='calendar_source' and v_action='update' then
        (select jsonb_agg(room_id order by room_id) from (select distinct room_id from (values
          (v_source.room_type_id),((v_payload->>'room_type_id')::uuid)) rooms(room_id)
          where room_id is not null) affected)
      when v_source.room_type_id is not null then jsonb_build_array(v_source.room_type_id)
      when v_payload->>'room_type_id' is not null then jsonb_build_array(v_payload->'room_type_id')
      else '[]'::jsonb end,
    'from',null,'to',null);
  v_plan:=jsonb_build_object('contract_version','hotels_v2_external_calendar_plan_v1','review_id',v_review,
    'actor_type',p_actor_type,'partner_id',v_partner,'hotel_id',v_hotel,'assignment_id',v_assignment,
    'permission_version',v_permission,'access_snapshot_token',v_access,
    'snapshot_token',v_control->>'snapshot_token','reviewed_at',v_reviewed,'expires_at',v_expires,
    'operations',jsonb_build_array(v_operation));
  v_fingerprint:=public.hotel_v2_external_calendar_worker_hash(v_plan);
  v_plan:=v_plan||jsonb_build_object('plan_fingerprint',v_fingerprint);
  insert into hotels_v2_private.hotel_external_calendar_plan_reviews(id,actor_type,actor_id,partner_id,
    hotel_id,assignment_id,permission_version,access_snapshot_token,snapshot_token,reviewed_plan,
    plan_fingerprint,expires_at) values(v_review,p_actor_type,v_actor,v_partner,v_hotel,v_assignment,
    v_permission,v_access,v_control->>'snapshot_token',v_plan,v_fingerprint,v_expires);
  return jsonb_build_object('contract_version','hotels_v2_external_calendar_preview_v1',
    'hotel_id',v_hotel,'partner_id',v_partner,'changed',true,'blocking_reasons','[]'::jsonb,
    'impacts',jsonb_build_array(v_impact),'reviewed_plan',v_plan);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_draft';
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_external_calendar_apply_common_114490(p_actor_type text, p_reviewed_plan jsonb, p_correlation_id uuid, p_idempotency_key uuid, p_ical_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare v_actor uuid:=auth.uid(); v_review hotels_v2_private.hotel_external_calendar_plan_reviews%rowtype;
  v_hash text; v_request_hash text; v_operation jsonb; v_hotel uuid; v_partner uuid;
  v_control jsonb; v_before jsonb; v_after jsonb; v_source public.hotel_calendar_source_configs%rowtype;
  v_entity text;v_action text;v_id uuid;v_expected bigint;v_payload jsonb;v_activity jsonb;v_result jsonb;
  v_receipt jsonb; v_binding_version bigint; v_ledger_action text;
begin
  if v_actor is null or p_reviewed_plan is null or jsonb_typeof(p_reviewed_plan)<>'object'
     or p_correlation_id is null or p_idempotency_key is null
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_reviewed_plan)
     or ((p_reviewed_plan#>>'{operations,0,entity}') is distinct from 'ical_secret'
        and p_ical_url is not null) then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_apply'; end if;
  v_request_hash:=public.hotel_v2_external_calendar_worker_hash(jsonb_build_object(
    'reviewed_plan',p_reviewed_plan,'url_fingerprint',case when p_ical_url is null then null
      else encode(extensions.digest(convert_to(btrim(p_ical_url),'UTF8'),'sha256'),'hex') end));
  perform pg_advisory_xact_lock(hashtextextended('hotels-v2-external-calendar-key:'||
    p_actor_type||':'||v_actor::text||':'||p_idempotency_key::text,0));
  perform pg_advisory_xact_lock(hashtextextended('hotels-v2-external-calendar:'||p_correlation_id,0));
  select result into v_receipt from hotels_v2_private.hotel_external_calendar_admin_receipts
    where p_actor_type='admin' and actor_id=v_actor and idempotency_key=p_idempotency_key;
  if v_receipt is null and p_actor_type='partner' then select receipt.result into v_receipt
    from public.hotel_partner_action_receipts receipt where receipt.actor_user_id=v_actor
      and receipt.partner_id=(p_reviewed_plan->>'partner_id')::uuid
      and receipt.action='h3_2d_external_calendar' and receipt.idempotency_key=p_idempotency_key; end if;
  if v_receipt is not null then
    if v_receipt->>'request_hash'<>v_request_hash or (v_receipt->>'correlation_id')::uuid<>p_correlation_id then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_idempotency_conflict'; end if;
    v_hotel:=(v_receipt->>'hotel_id')::uuid;v_partner:=case when v_receipt->>'partner_id' is null then null else (v_receipt->>'partner_id')::uuid end;
    v_control:=public.hotel_v2_external_calendar_control_common_114490(p_actor_type,v_partner,v_hotel);
    return (v_receipt-'request_hash')||jsonb_build_object('replayed',true,'control',v_control);
  end if;
  if exists(select 1 from hotels_v2_private.hotel_external_calendar_correlations where correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_activity_log activity where activity.correlation_id=p_correlation_id)
     or exists(select 1 from public.hotel_partner_action_receipts receipt where receipt.correlation_id=p_correlation_id) then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_correlation_conflict'; end if;
  select * into v_review from hotels_v2_private.hotel_external_calendar_plan_reviews
    where id=(p_reviewed_plan->>'review_id')::uuid for update;
  if not found or v_review.actor_type<>p_actor_type or v_review.actor_id<>v_actor
     or v_review.reviewed_plan is distinct from p_reviewed_plan or v_review.expires_at<=clock_timestamp()
     or v_review.consumed_at is not null then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_review_stale'; end if;
  v_hash:=public.hotel_v2_external_calendar_worker_hash(p_reviewed_plan-'plan_fingerprint');
  if v_hash<>p_reviewed_plan->>'plan_fingerprint' or v_hash<>v_review.plan_fingerprint then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_plan_mismatch'; end if;
  v_hotel:=v_review.hotel_id;v_partner:=v_review.partner_id;
  perform 1 from public.hotels where id=v_hotel for update;
  v_control:=public.hotel_v2_external_calendar_control_common_114490(p_actor_type,v_partner,v_hotel);
  if v_control->>'snapshot_token'<>v_review.snapshot_token
     or v_control->>'access_snapshot_token' is distinct from v_review.access_snapshot_token
     or (case when v_control->>'permission_version' is null then null
       else (v_control->>'permission_version')::bigint end) is distinct from v_review.permission_version then
    raise exception using errcode='PT409',message='hotels_v2_external_calendar_stale_snapshot'; end if;
  v_operation:=p_reviewed_plan#>'{operations,0}';v_entity:=v_operation->>'entity';v_action:=v_operation->>'action';
  v_id:=(v_operation->>'id')::uuid;v_expected:=(v_operation->>'expected_version')::bigint;v_payload:=v_operation->'payload';
  if jsonb_array_length(p_reviewed_plan->'operations')<>1 then raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_apply'; end if;
  select * into v_source from public.hotel_calendar_source_configs where id=v_id and hotel_id=v_hotel for update;
  v_before:=case when found then public.hotel_v2_external_calendar_source_projection(v_id) else null end;
  if v_entity='calendar_source' and v_action='create' then
    if v_before is not null or v_expected<>0 then raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_stale'; end if;
    perform set_config('hotels_v2.external_calendar_apply_context',p_correlation_id::text,true);
    perform set_config('hotels_v2.external_calendar_apply_action','create',true);
    insert into public.hotel_calendar_source_configs(id,hotel_id,room_type_id,code,source_type,configuration,
      is_enabled,review_status,priority,version) values(v_id,v_hotel,(v_payload->>'room_type_id')::uuid,
      v_payload->>'code',v_payload->>'source_type',jsonb_build_object('sync_interval_minutes',v_payload->'sync_interval_minutes',
        'units_per_event',v_payload->'units_per_event'),false,'reviewed',(v_payload->>'priority')::smallint,1);
  elsif v_entity='calendar_source' and v_action='update' then
    if v_before is distinct from v_operation->'expected_original' or v_source.version<>v_expected then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_stale'; end if;
    perform set_config('hotels_v2.external_calendar_apply_context',p_correlation_id::text,true);
    perform set_config('hotels_v2.external_calendar_apply_action','update',true);
    update public.hotel_calendar_source_configs set room_type_id=(v_payload->>'room_type_id')::uuid,code=v_payload->>'code',
      source_type=v_payload->>'source_type',
      configuration=jsonb_build_object('sync_interval_minutes',v_payload->'sync_interval_minutes',
        'units_per_event',v_payload->'units_per_event'),priority=(v_payload->>'priority')::smallint,
      version=version+1,updated_at=clock_timestamp() where id=v_id;
  elsif v_entity='calendar_source' and v_action in('enable','disable') then
    if v_before is distinct from v_operation->'expected_original' or v_source.version<>v_expected then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_stale'; end if;
    if v_action='enable' and (
       not coalesce((select hotel_external_sync_enabled from public.site_settings
         where id=1),false)
       or not hotels_post_114489_private.calendar_scheduler_ready_114490()
       or not exists(select 1 from hotels_v2_private.hotel_external_calendar_source_secrets
         where source_id=v_id)
       or exists(select 1 from public.hotel_calendar_source_configs other
         where other.hotel_id=v_hotel and other.room_type_id=v_source.room_type_id
           and other.is_enabled and other.id<>v_id)) then
      raise exception using errcode='23514',
        message='hotels_v2_external_calendar_source_not_activatable';
    end if;
    perform set_config('hotels_v2.external_calendar_apply_context',p_correlation_id::text,true);
    perform set_config('hotels_v2.external_calendar_apply_action',v_action,true);
    update public.hotel_calendar_source_configs set is_enabled=(v_action='enable'),version=version+1,
      updated_at=clock_timestamp() where id=v_id;
  elsif v_entity='ical_secret' and v_action in('set','rotate','clear') then
    if v_source.id is null or v_source.is_enabled
       or exists(select 1 from hotels_v2_private.hotel_external_calendar_sync_jobs job
         where job.source_id=v_id and job.status in('queued','leased','running')) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_secret_source_stale'; end if;
    if v_action='clear' then
      if p_ical_url is not null then raise exception using errcode='22023',message='hotels_v2_external_calendar_unexpected_secret_url'; end if;
      if (select jsonb_build_object('secret_configured',true,'binding_version',binding.version)
          from hotels_v2_private.hotel_external_calendar_source_secrets binding where binding.source_id=v_id)
          is distinct from v_operation->'expected_original' then
        raise exception using errcode='PT409',message='hotels_v2_external_calendar_binding_stale'; end if;
      delete from vault.secrets secret using hotels_v2_private.hotel_external_calendar_source_secrets binding
        where binding.source_id=v_id and secret.id=binding.vault_secret_id;
      if not found then raise exception using errcode='55000',message='hotels_v2_external_calendar_vault_secret_missing'; end if;
      delete from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_id;
      v_binding_version:=null;
    else
      if p_ical_url is null then raise exception using errcode='22023',message='hotels_v2_external_calendar_secret_url_required'; end if;
      v_binding_version:=public.hotel_v2_external_calendar_set_secret_internal(v_id,
        coalesce((v_operation#>>'{expected_original,binding_version}')::bigint,0),p_ical_url,v_payload->>'url_fingerprint');
    end if;
  elsif v_entity='calendar_sync' and v_action='trigger' then
    if not coalesce((select hotel_external_sync_enabled from public.site_settings
         where id=1),false)
       or not hotels_post_114489_private.calendar_scheduler_ready_114490()
       or v_source.id is null or not v_source.is_enabled
       or not public.hotel_v2_external_calendar_ics_source_type_is_supported(
         v_source.source_type) then
      raise exception using errcode='23514',
        message='hotels_v2_external_calendar_source_not_triggerable';
    end if;
    if p_ical_url is not null or v_before is distinct from v_operation->'expected_original'
       or v_expected<>coalesce((v_before#>>'{health,state_version}')::bigint,0) then
      raise exception using errcode='PT409',message='hotels_v2_external_calendar_source_stale'; end if;
    select version into strict v_binding_version from hotels_v2_private.hotel_external_calendar_source_secrets where source_id=v_id;
    insert into hotels_v2_private.hotel_external_calendar_sync_jobs(id,source_id,hotel_id,room_type_id,
      trigger_type,source_version,binding_version,created_by_type,created_by,correlation_id)
    values(gen_random_uuid(),v_id,v_hotel,v_source.room_type_id,'manual',v_source.version,
      v_binding_version,p_actor_type,v_actor,p_correlation_id);
  else raise exception using errcode='22023',message='hotels_v2_external_calendar_invalid_apply'; end if;
  if v_entity<>'ical_secret' and p_ical_url is not null then
    raise exception using errcode='22023',message='hotels_v2_external_calendar_unexpected_secret_url'; end if;
  v_after:=case when v_entity='calendar_sync' then jsonb_build_object('queued',true)
    when v_entity='ical_secret' then jsonb_build_object('secret_configured',v_action<>'clear','binding_version',v_binding_version)
    else public.hotel_v2_external_calendar_source_projection(v_id) end;
  v_ledger_action:=case when v_action='create' then 'create' when v_action='disable' then 'disable' else 'update' end;
  insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,
    actor_type,actor_id,source,correlation_id) values(v_hotel,'calendar_source',v_id,v_ledger_action,
    nullif(v_operation->'expected_original','null'::jsonb),v_after,p_actor_type,v_actor,
    'hotels_v2_external_calendar_control',p_correlation_id)
    returning jsonb_build_object('id',id,'hotel_id',hotel_id,'entity_type',entity_type,'entity_id',entity_id,
      'action',action,'actor_type',actor_type,'source',source,'correlation_id',correlation_id,'created_at',created_at)
      into v_activity;
  update hotels_v2_private.hotel_external_calendar_plan_reviews set consumed_at=clock_timestamp(),
    consumed_correlation_id=p_correlation_id where id=v_review.id;
  insert into hotels_v2_private.hotel_external_calendar_correlations values(
    p_correlation_id,p_actor_type,v_actor,p_idempotency_key,v_request_hash);
  v_result:=jsonb_build_object('contract_version','hotels_v2_external_calendar_apply_result_v1',
    'hotel_id',v_hotel,'partner_id',v_partner,'correlation_id',p_correlation_id,
    'idempotency_key',p_idempotency_key,'replayed',false,'changed',true,
    'activity',jsonb_build_array(v_activity),'request_hash',v_request_hash);
  if p_actor_type='admin' then insert into hotels_v2_private.hotel_external_calendar_admin_receipts(
    actor_id,hotel_id,idempotency_key,correlation_id,request_hash,result)
    values(v_actor,v_hotel,p_idempotency_key,p_correlation_id,v_request_hash,v_result);
  else insert into public.hotel_partner_action_receipts(partner_id,hotel_id,actor_user_id,action,
    idempotency_key,request_hash,correlation_id,result) values(v_partner,v_hotel,v_actor,
      'h3_2d_external_calendar',p_idempotency_key,v_request_hash,p_correlation_id,v_result); end if;
  v_control:=public.hotel_v2_external_calendar_control_common_114490(p_actor_type,v_partner,v_hotel);
  return (v_result-'request_hash')||jsonb_build_object('control',v_control);
exception when unique_violation then
  raise exception using errcode='PT409',message='hotels_v2_external_calendar_apply_conflict';
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_get_external_calendar_control_114490(p_hotel_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$select public.hotel_v2_external_calendar_control_common_114490('admin',null,p_hotel_id)$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_preview_external_calendar_plan_114490(p_draft jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  return public.hotel_v2_external_calendar_preview_common_114490('admin',p_draft);
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_apply_external_calendar_plan_114490(p_reviewed_plan jsonb, p_correlation_id uuid, p_idempotency_key uuid, p_ical_url text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
begin
  perform public.hotel_v2_h2a_require_admin();
  return public.hotel_v2_external_calendar_apply_common_114490(
    'admin',p_reviewed_plan,p_correlation_id,p_idempotency_key,p_ical_url);
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_get_external_calendar_provider_reviews_114490(p_hotel_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_proposals jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if v_actor is null or p_hotel_id is null then
    raise exception using errcode='22023',
      message='hotels_v2_external_calendar_provider_invalid_review_list';
  end if;
  perform public.hotel_v2_external_calendar_control_common_114490('admin',null,p_hotel_id);
  perform hotels_v2_private.hotel_external_calendar_provider_expire_pending(
    p_hotel_id,v_actor);
  select coalesce(jsonb_agg(
      hotels_v2_private.hotel_external_calendar_provider_proposal_summary(
        candidate.id) order by candidate.submitted_at desc,candidate.id),
      '[]'::jsonb)
    into v_proposals
  from (select proposal.id,proposal.submitted_at
    from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
    where proposal.hotel_id=p_hotel_id
    order by proposal.submitted_at desc,proposal.id limit 100) candidate;
  return jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_provider_review_list_v1',
    'hotel_id',p_hotel_id,'proposals',v_proposals);
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_preview_extcal_partner_proposal_114490(p_proposal_id uuid, p_admin_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_proposal hotels_v2_private.hotel_external_calendar_partner_proposals%rowtype;
  v_control jsonb;
  v_draft jsonb;
  v_payload jsonb;
  v_preview jsonb;
  v_admin_plan jsonb;
  v_url text;
begin
  perform public.hotel_v2_h2a_require_admin();
  if v_actor is null or p_proposal_id is null
     or not public.hotel_v2_external_calendar_reason_valid(to_jsonb(p_admin_reason)) then
    raise exception using errcode='22023',
      message='hotels_v2_external_calendar_provider_invalid_admin_reason';
  end if;
  select * into v_proposal
  from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
  where proposal.id=p_proposal_id for update;
  if not found then
    raise exception using errcode='PT404',
      message='hotels_v2_external_calendar_provider_proposal_not_found';
  end if;
  if v_proposal.status<>'pending_admin_review'
     or v_proposal.expires_at<=clock_timestamp()
     or not exists(select 1
       from public.hotel_partner_hotel_permissions permission
       where permission.assignment_id=v_proposal.assignment_id
         and permission.partner_id=v_proposal.partner_id
         and permission.hotel_id=v_proposal.hotel_id
         and permission.version=v_proposal.permission_version
         and permission.manage_availability) then
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_proposal_stale';
  end if;
  v_control:=public.hotel_v2_external_calendar_control_common_114490(
    'admin',null,v_proposal.hotel_id);
  if v_control->>'snapshot_token' is distinct from v_proposal.snapshot_token then
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_proposal_stale';
  end if;
  v_payload:=v_proposal.operation->'payload';
  if v_proposal.entity='ical_secret'
     and v_proposal.action in('set','rotate') then
    select secret.decrypted_secret into v_url
    from vault.decrypted_secrets secret
    where secret.id=v_proposal.vault_secret_id
      and secret.name='hotel-calendar-proposal-'||v_proposal.id::text;
    if not found or encode(extensions.digest(convert_to(v_url,'UTF8'),'sha256'),
         'hex') is distinct from v_proposal.url_fingerprint then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_staged_secret_mismatch';
    end if;
    v_payload:=jsonb_build_object(
      'source_id',v_proposal.source_id,'ical_url',v_url);
  end if;
  v_draft:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_draft_v1',
    'hotel_id',v_proposal.hotel_id,'partner_id',null,'assignment_id',null,
    'permission_version',null,'access_snapshot_token',null,
    'snapshot_token',v_control->>'snapshot_token',
    'intent',jsonb_build_object(
      'entity',v_proposal.entity,'action',v_proposal.action,
      'id',v_proposal.source_id,
      'expected_version',v_proposal.operation->'expected_version',
      'payload',v_payload,'reason',p_admin_reason));
  perform set_config('hotels_v2.external_calendar_provider_proposal_id',
    v_proposal.id::text,true);
  v_preview:=public.hotel_v2_external_calendar_preview_common_114490('admin',v_draft);
  perform set_config('hotels_v2.external_calendar_provider_proposal_id','',true);
  v_url:=null;
  v_admin_plan:=v_preview->'reviewed_plan';
  if v_preview->>'changed'<>'true' or v_admin_plan is null
     or v_admin_plan->>'actor_type'<>'admin'
     or v_admin_plan->'partner_id'<>'null'::jsonb
     or v_admin_plan->'assignment_id'<>'null'::jsonb
     or v_admin_plan->'permission_version'<>'null'::jsonb
     or v_admin_plan->'access_snapshot_token'<>'null'::jsonb
     or ((v_admin_plan#>'{operations,0}')-'reason') is distinct from
       (v_proposal.operation-'reason')
     or v_admin_plan#>>'{operations,0,reason}' is distinct from p_admin_reason then
    raise exception using errcode='55000',
      message='hotels_v2_external_calendar_provider_admin_preview_mismatch';
  end if;
  insert into hotels_v2_private.hotel_external_calendar_provider_admin_previews(
    admin_review_id,proposal_id,actor_id,partner_plan_fingerprint,
    admin_plan_fingerprint,admin_reason,created_at,expires_at)
  values((v_admin_plan->>'review_id')::uuid,v_proposal.id,v_actor,
    v_proposal.plan_fingerprint,v_admin_plan->>'plan_fingerprint',p_admin_reason,
    (v_admin_plan->>'reviewed_at')::timestamptz,
    (v_admin_plan->>'expires_at')::timestamptz);
  return jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_provider_admin_preview_v1',
    'proposal',hotels_v2_private.hotel_external_calendar_provider_proposal_summary(
      v_proposal.id),'preview',v_preview);
end
$function$;


CREATE OR REPLACE FUNCTION public.hotel_v2_admin_apply_external_calendar_partner_proposal_114490(p_proposal_id uuid, p_reviewed_plan jsonb, p_correlation_id uuid, p_idempotency_key uuid, p_admin_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_proposal hotels_v2_private.hotel_external_calendar_partner_proposals%rowtype;
  v_preview hotels_v2_private.hotel_external_calendar_provider_admin_previews%rowtype;
  v_request_hash text;
  v_url text;
  v_apply jsonb;
  v_record jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if v_actor is null or p_proposal_id is null or p_reviewed_plan is null
     or jsonb_typeof(p_reviewed_plan) is distinct from 'object'
     or p_correlation_id is null or p_idempotency_key is null
     or not public.hotel_v2_external_calendar_reason_valid(to_jsonb(p_admin_reason))
     or not public.hotel_v2_admin_c_json_uuid_fields_are_canonical(p_reviewed_plan) then
    raise exception using errcode='22023',
      message='hotels_v2_external_calendar_provider_invalid_admin_apply';
  end if;
  v_request_hash:=public.hotel_v2_external_calendar_worker_hash(jsonb_build_object(
    'proposal_id',p_proposal_id,'reviewed_plan',p_reviewed_plan,
    'decision','accepted','admin_reason',p_admin_reason));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-external-calendar-provider-admin:'||v_actor::text||':'||
      p_idempotency_key::text,0));
  perform pg_advisory_xact_lock(hashtextextended(
    'hotels-v2-external-calendar-provider-correlation:'||p_correlation_id::text,0));
  select * into v_proposal
  from hotels_v2_private.hotel_external_calendar_partner_proposals proposal
  where proposal.id=p_proposal_id for update;
  if not found then
    raise exception using errcode='PT404',
      message='hotels_v2_external_calendar_provider_proposal_not_found';
  end if;
  if v_proposal.status<>'pending_admin_review' then
    if v_proposal.status='accepted'
       and v_proposal.reviewed_by=v_actor
       and v_proposal.consumed_correlation_id=p_correlation_id
       and v_proposal.consumed_idempotency_key=p_idempotency_key
       and v_proposal.result->>'request_hash'=v_request_hash then
      return jsonb_build_object(
        'contract_version','hotels_v2_external_calendar_provider_admin_apply_v1',
        'proposal',hotels_v2_private.hotel_external_calendar_provider_proposal_summary(
          v_proposal.id),'apply',v_proposal.result->'apply','replayed',true);
    end if;
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_proposal_decision_conflict';
  end if;
  if v_proposal.expires_at<=clock_timestamp()
     or not exists(select 1
       from public.hotel_partner_hotel_permissions permission
       where permission.assignment_id=v_proposal.assignment_id
         and permission.partner_id=v_proposal.partner_id
         and permission.hotel_id=v_proposal.hotel_id
         and permission.version=v_proposal.permission_version
         and permission.manage_availability) then
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_proposal_stale';
  end if;
  select * into v_preview
  from hotels_v2_private.hotel_external_calendar_provider_admin_previews preview
  where preview.admin_review_id=(p_reviewed_plan->>'review_id')::uuid
    and preview.proposal_id=v_proposal.id
    and preview.actor_id=v_actor;
  if not found or v_preview.expires_at<=clock_timestamp()
     or v_preview.partner_plan_fingerprint<>v_proposal.plan_fingerprint
     or v_preview.admin_plan_fingerprint<>p_reviewed_plan->>'plan_fingerprint'
     or v_preview.admin_reason<>p_admin_reason
     or public.hotel_v2_external_calendar_worker_hash(
       p_reviewed_plan-'plan_fingerprint')<>v_preview.admin_plan_fingerprint
     or p_reviewed_plan->>'actor_type'<>'admin'
     or ((p_reviewed_plan#>'{operations,0}')-'reason') is distinct from
       (v_proposal.operation-'reason')
     or p_reviewed_plan#>>'{operations,0,reason}'<>p_admin_reason then
    raise exception using errcode='PT409',
      message='hotels_v2_external_calendar_provider_admin_review_mismatch';
  end if;
  if v_proposal.vault_secret_id is not null then
    select secret.decrypted_secret into v_url
    from vault.decrypted_secrets secret
    where secret.id=v_proposal.vault_secret_id
      and secret.name='hotel-calendar-proposal-'||v_proposal.id::text;
    if not found or encode(extensions.digest(convert_to(v_url,'UTF8'),'sha256'),
         'hex') is distinct from v_proposal.url_fingerprint then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_staged_secret_mismatch';
    end if;
  end if;
  if v_proposal.vault_secret_id is not null then
    perform set_config('hotels_v2.external_calendar_provider_proposal_id',
      v_proposal.id::text,true);
    perform set_config('hotels_v2.external_calendar_provider_staged_secret_id',
      v_proposal.vault_secret_id::text,true);
  end if;
  v_apply:=public.hotel_v2_external_calendar_apply_common_114490(
    'admin',p_reviewed_plan,p_correlation_id,p_idempotency_key,v_url);
  perform set_config('hotels_v2.external_calendar_provider_proposal_id','',true);
  perform set_config('hotels_v2.external_calendar_provider_staged_secret_id','',true);
  v_url:=null;
  if v_proposal.vault_secret_id is not null then
    if (select count(*)
      from hotels_v2_private.hotel_external_calendar_source_secrets binding
      join vault.secrets secret on secret.id=binding.vault_secret_id
      where binding.source_id=v_proposal.source_id
        and binding.vault_secret_id=v_proposal.vault_secret_id
        and binding.url_fingerprint=v_proposal.url_fingerprint
        and binding.version=(v_proposal.operation->>'expected_version')::bigint+1
        and secret.name='hotel-calendar-source-'||v_proposal.source_id::text||'-'||
          v_proposal.vault_secret_id::text)<>1 then
      raise exception using errcode='55000',
        message='hotels_v2_external_calendar_provider_secret_promotion_mismatch';
    end if;
  end if;
  v_record:=jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_provider_decision_record_v1',
    'proposal_id',v_proposal.id,'decision','accepted','expired',false,
    'request_hash',v_request_hash,'url_fingerprint',v_proposal.url_fingerprint,
    'apply',v_apply);
  update hotels_v2_private.hotel_external_calendar_partner_proposals set
    status='accepted',reviewed_at=clock_timestamp(),reviewed_by=v_actor,
    admin_reason=p_admin_reason,consumed_correlation_id=p_correlation_id,
    consumed_idempotency_key=p_idempotency_key,result=v_record,
    vault_secret_id=null,url_fingerprint=null
  where id=v_proposal.id;
  perform hotels_v2_private.hotel_external_calendar_provider_write_review_receipt(
    v_proposal.id,'accepted',v_actor,p_correlation_id,p_idempotency_key,
    v_record,p_admin_reason);
  return jsonb_build_object(
    'contract_version','hotels_v2_external_calendar_provider_admin_apply_v1',
    'proposal',hotels_v2_private.hotel_external_calendar_provider_proposal_summary(
      v_proposal.id),'apply',v_apply,'replayed',false);
exception when unique_violation then
  raise exception using errcode='PT409',
    message='hotels_v2_external_calendar_provider_admin_apply_conflict';
end
$function$;



-- =========================================================
-- ACL: private / internal successor helpers.
-- =========================================================

REVOKE ALL
ON FUNCTION
  hotels_post_114489_private.safe_state_114490(),
  hotels_post_114489_private.predecessor_flag_exact_114490(text,boolean),
  hotels_post_114489_private.calendar_provider_lineage_bridge_114490(),
  hotels_post_114489_private.calendar_scheduler_ready_114490(),

  public.hotel_v2_admin_c_pricing_control_snapshot_114490(uuid),

  public.hotel_v2_admin_d_snapshot_external_base_114490(uuid,date,date,boolean),
  public.hotel_v2_admin_d_snapshot_114490(uuid,date,date,boolean),
  public.hotel_v2_admin_d_current_foundation_snapshot_114490(),
  public.hotel_v2_admin_d_review_plan_114490(jsonb),

  public.hotel_v2_external_calendar_site_settings_fingerprint_114490(),
  public.hotel_v2_external_calendar_control_common_114490(text,uuid,uuid),
  public.hotel_v2_external_calendar_preview_common_114490(text,jsonb),
  public.hotel_v2_external_calendar_apply_common_114490(text,jsonb,uuid,uuid,text)
FROM PUBLIC,anon,authenticated,service_role;


-- =========================================================
-- ACL: user-facing ADMIN successor RPCs.
-- =========================================================

REVOKE ALL
ON FUNCTION
  public.hotel_v2_admin_get_capability_lifecycle_114490(),
  public.hotel_v2_admin_get_content_control_114490(uuid),

  public.hotel_v2_admin_get_pricing_control_114490(uuid),
  public.hotel_v2_admin_preview_pricing_quote_114490(jsonb),
  public.hotel_v2_admin_apply_pricing_control_plan_114490(jsonb,uuid,text),

  public.hotel_v2_admin_get_availability_control_114490(uuid,date,date),
  public.hotel_v2_admin_preview_availability_plan_114490(jsonb),
  public.hotel_v2_admin_apply_availability_control_plan_114490(jsonb,uuid,text),
  public.hotel_v2_admin_preview_stay_114490(jsonb),

  public.hotel_v2_admin_get_external_calendar_control_114490(uuid),
  public.hotel_v2_admin_preview_external_calendar_plan_114490(jsonb),
  public.hotel_v2_admin_apply_external_calendar_plan_114490(jsonb,uuid,uuid,text),
  public.hotel_v2_admin_get_external_calendar_provider_reviews_114490(uuid),
  public.hotel_v2_admin_preview_extcal_partner_proposal_114490(uuid,text),
  public.hotel_v2_admin_apply_external_calendar_partner_proposal_114490(uuid,jsonb,uuid,uuid,text)
FROM PUBLIC,anon,authenticated,service_role;


GRANT EXECUTE
ON FUNCTION
  public.hotel_v2_admin_get_capability_lifecycle_114490(),
  public.hotel_v2_admin_get_content_control_114490(uuid),

  public.hotel_v2_admin_get_pricing_control_114490(uuid),
  public.hotel_v2_admin_preview_pricing_quote_114490(jsonb),
  public.hotel_v2_admin_apply_pricing_control_plan_114490(jsonb,uuid,text),

  public.hotel_v2_admin_get_availability_control_114490(uuid,date,date),
  public.hotel_v2_admin_preview_availability_plan_114490(jsonb),
  public.hotel_v2_admin_apply_availability_control_plan_114490(jsonb,uuid,text),
  public.hotel_v2_admin_preview_stay_114490(jsonb),

  public.hotel_v2_admin_get_external_calendar_control_114490(uuid),
  public.hotel_v2_admin_preview_external_calendar_plan_114490(jsonb),
  public.hotel_v2_admin_apply_external_calendar_plan_114490(jsonb,uuid,uuid,text),
  public.hotel_v2_admin_get_external_calendar_provider_reviews_114490(uuid),
  public.hotel_v2_admin_preview_extcal_partner_proposal_114490(uuid,text),
  public.hotel_v2_admin_apply_external_calendar_partner_proposal_114490(uuid,jsonb,uuid,uuid,text)
TO authenticated;

-- Source-routing closure:
-- no successor may route back into the known stale helpers.
-- =========================================================

CREATE TEMP TABLE forbidden_source (
  signature regprocedure,
  forbidden text
) ON COMMIT DROP;


INSERT INTO forbidden_source
VALUES

(
  'hotels_post_114489_private.safe_state_114490()'::regprocedure,
  'hotels_lifecycle_private.chain_state()'
),

(
  'hotels_post_114489_private.predecessor_flag_exact_114490(text,boolean)'::regprocedure,
  'hotels_lifecycle_private.safe_state()'
),

(
  'public.hotel_v2_admin_c_pricing_control_snapshot_114490(uuid)'::regprocedure,
  'hotels_lifecycle_private.safe_state()'
),

(
  'public.hotel_v2_admin_preview_pricing_quote_114490(jsonb)'::regprocedure,
  'public.hotel_v2_admin_c_pricing_control_snapshot('
),

(
  'public.hotel_v2_admin_apply_pricing_control_plan_114490(jsonb,uuid,text)'::regprocedure,
  'public.hotel_v2_admin_c_pricing_control_snapshot('
),

(
  'public.hotel_v2_admin_d_snapshot_external_base_114490(uuid,date,date,boolean)'::regprocedure,
  'hotels_lifecycle_private.predecessor_flag_exact('
),

(
  'public.hotel_v2_admin_d_snapshot_114490(uuid,date,date,boolean)'::regprocedure,
  'public.hotel_v2_admin_d_snapshot_external_base('
),

(
  'public.hotel_v2_admin_d_current_foundation_snapshot_114490()'::regprocedure,
  'hotels_lifecycle_private.predecessor_flag_exact('
),

(
  'public.hotel_v2_admin_d_current_foundation_snapshot_114490()'::regprocedure,
  'public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'
),

(
  'public.hotel_v2_admin_d_review_plan_114490(jsonb)'::regprocedure,
  'public.hotel_v2_admin_d_snapshot('
),

(
  'public.hotel_v2_admin_get_availability_control_114490(uuid,date,date)'::regprocedure,
  'public.hotel_v2_admin_d_snapshot('
),

(
  'public.hotel_v2_admin_preview_availability_plan_114490(jsonb)'::regprocedure,
  'public.hotel_v2_admin_d_review_plan('
),

(
  'public.hotel_v2_admin_apply_availability_control_plan_114490(jsonb,uuid,text)'::regprocedure,
  'public.hotel_v2_admin_d_snapshot('
),

(
  'public.hotel_v2_admin_preview_stay_114490(jsonb)'::regprocedure,
  'public.hotel_v2_admin_d_snapshot('
),

(
  'public.hotel_v2_admin_preview_stay_114490(jsonb)'::regprocedure,
  'public.hotel_v2_admin_get_pricing_control('
),

(
  'public.hotel_v2_external_calendar_site_settings_fingerprint_114490()'::regprocedure,
  'hotels_lifecycle_private.predecessor_flag_exact('
),

(
  'hotels_post_114489_private.calendar_scheduler_ready_114490()'::regprocedure,
  'public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()'
),

(
  'public.hotel_v2_external_calendar_control_common_114490(text,uuid,uuid)'::regprocedure,
  'hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready()'
),

(
  'public.hotel_v2_external_calendar_preview_common_114490(text,jsonb)'::regprocedure,
  'public.hotel_v2_external_calendar_control_common('
),

(
  'public.hotel_v2_external_calendar_preview_common_114490(text,jsonb)'::regprocedure,
  'hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready()'
),

(
  'public.hotel_v2_external_calendar_apply_common_114490(text,jsonb,uuid,uuid,text)'::regprocedure,
  'public.hotel_v2_external_calendar_control_common('
),

(
  'public.hotel_v2_external_calendar_apply_common_114490(text,jsonb,uuid,uuid,text)'::regprocedure,
  'hotels_v2_private.hotel_external_calendar_provider_worker_scheduler_is_ready()'
);


DO $source_closure$
DECLARE
  bad record;
BEGIN

  SELECT
    f.signature,
    f.forbidden
  INTO bad
  FROM forbidden_source f
  JOIN pg_catalog.pg_proc p
    ON p.oid=f.signature
  WHERE pg_catalog.strpos(p.prosrc, f.forbidden)>0
  LIMIT 1;


  IF FOUND THEN

    RAISE EXCEPTION
      'hotels_114490_successor_routes_to_stale_helper:%:%',
      bad.signature,
      bad.forbidden;

  END IF;


  IF EXISTS(
    SELECT 1
    FROM pg_catalog.pg_proc p
    WHERE p.oid IN (
      'public.hotel_v2_admin_c_pricing_control_snapshot_114490(uuid)'::regprocedure,
      'public.hotel_v2_admin_d_snapshot_external_base_114490(uuid,date,date,boolean)'::regprocedure,
      'public.hotel_v2_admin_d_current_foundation_snapshot_114490()'::regprocedure,
      'public.hotel_v2_external_calendar_control_common_114490(text,uuid,uuid)'::regprocedure
    )
    AND p.prosrc ~
      'architecture_version[[:space:]]*=[[:space:]]*''legacy'''
  ) THEN

    RAISE EXCEPTION
      'hotels_114490_legacy_architecture_guard_remaining';

  END IF;

END
$source_closure$;


SELECT
  'SOURCE_CLOSURE=PASS';

DO $post_114490$
DECLARE
  row_record record;
  proc_oid oid;
BEGIN

  PERFORM
    hotels_published_architecture_private.assert_receipt_exact();


  IF
    r5k_catalog_proof.payment_catalog_is_exact()
    IS DISTINCT FROM true
  THEN

    RAISE EXCEPTION
      'hotels_114490_post_payment_catalog_drift';

  END IF;


  IF
    r5k_catalog_proof.executor_d848c718a811c87cce08()
    IS DISTINCT FROM true
  THEN

    RAISE EXCEPTION
      'hotels_114490_post_calendar_bridge_drift';

  END IF;


  IF NOT EXISTS(
    SELECT 1
    FROM public.hotels
    WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      AND architecture_version='rooms_v2'
      AND is_published=true
      AND booking_mode='request_confirmation'
  )
  OR (
    SELECT count(*)
    FROM hotels_published_architecture_private.conversion_receipt
    WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  )<>1
  OR EXISTS(
    SELECT 1
    FROM hotels_published_architecture_private.property_history
    WHERE hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  )
  THEN

    RAISE EXCEPTION
      'hotels_114490_post_business_state_drift';

  END IF;


  FOR row_record IN
    SELECT signature
    FROM (
      VALUES
    ('public.hotel_v2_admin_get_capability_lifecycle_114490()'),
    ('public.hotel_v2_admin_get_content_control_114490(uuid)'),
    ('public.hotel_v2_admin_get_pricing_control_114490(uuid)'),
    ('public.hotel_v2_admin_preview_pricing_quote_114490(jsonb)'),
    ('public.hotel_v2_admin_apply_pricing_control_plan_114490(jsonb,uuid,text)'),
    ('public.hotel_v2_admin_get_availability_control_114490(uuid,date,date)'),
    ('public.hotel_v2_admin_preview_availability_plan_114490(jsonb)'),
    ('public.hotel_v2_admin_apply_availability_control_plan_114490(jsonb,uuid,text)'),
    ('public.hotel_v2_admin_preview_stay_114490(jsonb)'),
    ('public.hotel_v2_admin_get_external_calendar_control_114490(uuid)'),
    ('public.hotel_v2_admin_preview_external_calendar_plan_114490(jsonb)'),
    ('public.hotel_v2_admin_apply_external_calendar_plan_114490(jsonb,uuid,uuid,text)'),
    ('public.hotel_v2_admin_get_external_calendar_provider_reviews_114490(uuid)'),
    ('public.hotel_v2_admin_preview_extcal_partner_proposal_114490(uuid,text)'),
    ('public.hotel_v2_admin_apply_external_calendar_partner_proposal_114490(uuid,jsonb,uuid,uuid,text)')
    ) expected(signature)
  LOOP

    proc_oid:=
      pg_catalog.to_regprocedure(
        row_record.signature
      );


    IF proc_oid IS NULL THEN

      RAISE EXCEPTION
        'hotels_114490_missing_rpc:%',
        row_record.signature;

    END IF;


    IF
      NOT pg_catalog.has_function_privilege(
        'authenticated',
        proc_oid,
        'EXECUTE'
      )
      OR pg_catalog.has_function_privilege(
        0::oid,
        proc_oid,
        'EXECUTE'
      )
      OR pg_catalog.has_function_privilege(
        'anon',
        proc_oid,
        'EXECUTE'
      )
      OR pg_catalog.has_function_privilege(
        'service_role',
        proc_oid,
        'EXECUTE'
      )
    THEN

      RAISE EXCEPTION
        'hotels_114490_rpc_acl_invalid:%',
        row_record.signature;

    END IF;

  END LOOP;


  IF (
    SELECT count(*)
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n
      ON n.oid=p.pronamespace
    WHERE
      (
        n.nspname='hotels_post_114489_private'
        OR
        (
          n.nspname='public'
          AND p.proname LIKE '%114490'
        )
      )
  ) < 20 THEN

    RAISE EXCEPTION
      'hotels_114490_successor_function_set_incomplete';

  END IF;

END
$post_114490$;

COMMIT;
