-- car-rental-end-to-end-public-eligibility-verify-v1
-- READ ONLY. Returns exactly one summary row and reads no customer PII.
-- Run immediately after 20260810140000 with both capability flags still OFF.

with
speedbikes_ids(offer_id) as (
  values
    ('afd191d3-bbbf-5c7a-a8a1-12bde793ace1'::uuid),
    ('2817e6de-25ba-5237-b721-dbc0460a7de4'::uuid),
    ('ef800460-cfef-57c1-b3cd-7269f366b00c'::uuid),
    ('d78cee10-c980-5445-b59b-a7006f2f8718'::uuid),
    ('670f9df5-f9ac-5e38-821a-ac21847ff16d'::uuid),
    ('fee6c0e3-f213-53cb-9a94-bb7ed129ff58'::uuid),
    ('f9bef2d8-ddcf-51a0-af67-f5bd781e2a7e'::uuid),
    ('cb127f3f-60ab-5375-a443-ac7bfb7804ce'::uuid),
    ('81dd11d2-68cf-57e7-831c-ec076c3e6a8b'::uuid),
    ('7496b0a4-aee0-58bc-a440-2d478514fec3'::uuid),
    ('e217a068-afb5-5352-be8b-ab2f8b9313d9'::uuid),
    ('23192ab2-24ae-5bae-8123-54039c805560'::uuid),
    ('f1c56415-b0bd-5738-a8fa-114abd92adae'::uuid),
    ('34dfca00-59b2-5c78-9600-f24f5a21cbea'::uuid),
    ('a0ba9599-7194-594f-930e-fa48911a6c6d'::uuid),
    ('8df639ad-c4dc-5a04-b06e-c7f93313df05'::uuid),
    ('bacb158c-0bfb-5735-bd70-bafa5e589882'::uuid),
    ('4701fe6a-41f6-5b7a-ad6e-9fbc8aab7b9e'::uuid),
    ('9dc40c8c-0096-5405-aaf0-495ef479af74'::uuid),
    ('d54382fd-4761-5d49-92b5-81d83eda5fb9'::uuid),
    ('1860d043-132c-519b-bf97-c5eddc464087'::uuid),
    ('ecc945e9-eff8-5b7d-a478-b69689380dbd'::uuid)
),
function_state as (
  select
    count(*) filter (
      where procedure.oid = to_regprocedure(
        'public.car_threshold_offer_has_public_prerequisites(uuid)'
      )
        and procedure.prosecdef
        and procedure.provolatile = 's'
    )::integer as prerequisite_helper_count,
    count(*) filter (
      where procedure.oid = to_regprocedure(
        'public.car_threshold_offer_route_is_public_eligible(uuid,text,text)'
      )
        and procedure.prosecdef
        and procedure.provolatile = 's'
    )::integer as route_helper_count,
    count(*) filter (
      where procedure.oid = to_regprocedure(
        'public.resolve_public_threshold_offer_ids(text,text)'
      )
        and procedure.prosecdef
        and procedure.provolatile = 's'
        and procedure.proretset
    )::integer as exact_id_resolver_count,
    count(*) filter (
      where procedure.oid = to_regprocedure(
        'public.car_threshold_offer_city_availability_is_public(uuid,uuid)'
      )
        and procedure.prosecdef
        and procedure.provolatile = 's'
    )::integer as availability_helper_count,
    count(*) filter (
      where procedure.oid = to_regprocedure(
        'public.admin_save_car_offer_city_availability_batch(uuid,jsonb,jsonb)'
      )
        and procedure.prosecdef
        and procedure.provolatile = 'v'
        and procedure.proretset
    )::integer as admin_batch_rpc_count,
    count(*) filter (
      where procedure.oid = to_regprocedure(
        'public.admin_set_car_threshold_offer_activation_state(uuid,timestamptz,boolean)'
      )
        and procedure.prosecdef
        and procedure.provolatile = 'v'
    )::integer as admin_activation_rpc_count,
    max(procedure.prosrc) filter (
      where procedure.oid = to_regprocedure(
        'public.car_threshold_offer_has_public_prerequisites(uuid)'
      )
    ) as prerequisite_source,
    max(procedure.prosrc) filter (
      where procedure.oid = to_regprocedure(
        'public.car_threshold_offer_route_is_public_eligible(uuid,text,text)'
      )
    ) as route_source,
    max(procedure.prosrc) filter (
      where procedure.oid = to_regprocedure(
        'public.car_threshold_booking_public_eligibility_guard()'
      )
    ) as booking_guard_source,
    max(procedure.prosrc) filter (
      where procedure.oid = to_regprocedure(
        'public.admin_save_car_offer_city_availability_batch(uuid,jsonb,jsonb)'
      )
    ) as batch_source,
    max(procedure.prosrc) filter (
      where procedure.oid = to_regprocedure(
        'public.admin_set_car_threshold_offer_activation_state(uuid,timestamptz,boolean)'
      )
    ) as activation_source,
    max(procedure.prosrc) filter (
      where procedure.oid = to_regprocedure(
        'public.partner_service_fulfillment_partner_id_for_car_booking(uuid,text)'
      )
    ) as partner_resolver_source
  from pg_proc procedure
  where procedure.oid in (
    to_regprocedure('public.car_threshold_offer_has_public_prerequisites(uuid)'),
    to_regprocedure('public.car_threshold_offer_route_is_public_eligible(uuid,text,text)'),
    to_regprocedure('public.car_threshold_offer_city_availability_is_public(uuid,uuid)'),
    to_regprocedure('public.resolve_public_threshold_offer_ids(text,text)'),
    to_regprocedure('public.car_threshold_booking_public_eligibility_guard()'),
    to_regprocedure('public.admin_save_car_offer_city_availability_batch(uuid,jsonb,jsonb)'),
    to_regprocedure('public.admin_set_car_threshold_offer_activation_state(uuid,timestamptz,boolean)'),
    to_regprocedure('public.partner_service_fulfillment_partner_id_for_car_booking(uuid,text)')
  )
),
policy_state as (
  select
    count(*) filter (
      where policy.polrelid = 'public.car_offers'::regclass
        and policy.polname in (
          'car_offers_auth_select',
          'Anyone can view available car offers',
          'Authenticated users can view all offers'
        )
    )::integer as rogue_offer_policy_count,
    max(pg_get_expr(policy.polqual, policy.polrelid)) filter (
      where policy.polrelid = 'public.car_offers'::regclass
        and policy.polname = 'car_offers_public_select'
    ) as public_offer_policy,
    max(pg_get_expr(policy.polqual, policy.polrelid)) filter (
      where policy.polrelid = 'public.car_offers'::regclass
        and policy.polname = 'car_offers_authenticated_select'
    ) as authenticated_offer_policy,
    max(pg_get_expr(policy.polqual, policy.polrelid)) filter (
      where policy.polrelid = 'public.car_offer_city_availability'::regclass
        and policy.polname = 'car_offer_city_availability_public_read'
    ) as public_availability_policy,
    max(pg_get_expr(policy.polqual, policy.polrelid)) filter (
      where policy.polrelid = 'public.car_offer_daily_rate_tiers'::regclass
        and policy.polname = 'car_offer_daily_rate_tiers_public_read'
    ) as public_tier_policy
  from pg_policy policy
),
rls_state as (
  select count(*) filter (where table_state.relrowsecurity)::integer as enabled_count
  from pg_class table_state
  where table_state.oid in (
    'public.car_offers'::regclass,
    'public.car_offer_city_availability'::regclass,
    'public.car_offer_daily_rate_tiers'::regclass
  )
),
trigger_state as (
  select count(*) filter (
    where trigger_state.tgname = 'car_bookings_00_threshold_public_eligibility'
      and not trigger_state.tgisinternal
      and pg_get_triggerdef(trigger_state.oid) ilike '%before insert%'
      and pg_get_triggerdef(trigger_state.oid) ilike '%car_threshold_booking_public_eligibility_guard%'
  )::integer as booking_guard_trigger_count
  from pg_trigger trigger_state
  where trigger_state.tgrelid = 'public.car_bookings'::regclass
),
grant_state as (
  select
    has_function_privilege(
      'anon',
      'public.resolve_public_threshold_offer_ids(text,text)',
      'EXECUTE'
    ) as anon_resolver_execute,
    has_function_privilege(
      'authenticated',
      'public.resolve_public_threshold_offer_ids(text,text)',
      'EXECUTE'
    ) as authenticated_resolver_execute,
    has_function_privilege(
      'anon',
      'public.car_threshold_offer_city_availability_is_public(uuid,uuid)',
      'EXECUTE'
    ) as anon_availability_helper_execute,
    has_function_privilege(
      'anon',
      'public.admin_save_car_offer_city_availability_batch(uuid,jsonb,jsonb)',
      'EXECUTE'
    ) as anon_batch_execute,
    has_function_privilege(
      'authenticated',
      'public.admin_save_car_offer_city_availability_batch(uuid,jsonb,jsonb)',
      'EXECUTE'
    ) as authenticated_batch_execute,
    has_function_privilege(
      'service_role',
      'public.admin_save_car_offer_city_availability_batch(uuid,jsonb,jsonb)',
      'EXECUTE'
    ) as service_batch_execute,
    has_function_privilege(
      'anon',
      'public.admin_set_car_threshold_offer_activation_state(uuid,timestamptz,boolean)',
      'EXECUTE'
    ) as anon_activation_execute,
    has_function_privilege(
      'authenticated',
      'public.admin_set_car_threshold_offer_activation_state(uuid,timestamptz,boolean)',
      'EXECUTE'
    ) as authenticated_activation_execute,
    has_function_privilege(
      'service_role',
      'public.admin_set_car_threshold_offer_activation_state(uuid,timestamptz,boolean)',
      'EXECUTE'
    ) as service_activation_execute
),
flag_state as (
  select
    count(*)::integer as settings_row_count,
    count(*) filter (
      where setting.id = 1
        and setting.car_multi_city_mapped_enabled is false
        and setting.car_threshold_daily_rates_enabled is false
    )::integer as both_flags_off_count,
    coalesce(bool_or(setting.car_multi_city_mapped_enabled), false) as mapped_enabled,
    coalesce(bool_or(setting.car_threshold_daily_rates_enabled), false) as threshold_enabled
  from public.site_settings setting
),
legacy_state as (
  select
    count(*)::integer as offer_count,
    count(*) filter (
      where offer.pricing_strategy = 'legacy_compat'
        and offer.availability_mode = 'legacy'
    )::integer as legacy_compat_mode_count,
    md5(coalesce(string_agg(
      jsonb_build_array(
        offer.id,
        offer.price_per_day,
        offer.price_3days,
        offer.price_4_6days,
        offer.price_7_10days,
        offer.price_10plus_days,
        offer.currency,
        offer.location,
        offer.owner_partner_id,
        offer.deposit_amount,
        offer.insurance_per_day,
        offer.young_driver_fee,
        offer.young_driver_cost,
        offer.stock_count,
        offer.north_allowed,
        offer.is_available,
        offer.is_published,
        offer.submission_status
      )::text,
      E'\n' order by offer.id
    ), '')) as protected_fingerprint
  from public.car_offers offer
  where offer.id not in (select offer_id from speedbikes_ids)
),
public_resolution_state as (
  select count(*)::integer as threshold_id_count_while_flags_off
  from public.resolve_public_threshold_offer_ids('ayia-napa', 'ayia-napa')
),
summary as (
  select
    now() as inspected_at,
    functions.prerequisite_helper_count,
    functions.route_helper_count,
    functions.exact_id_resolver_count,
    functions.availability_helper_count,
    functions.admin_batch_rpc_count,
    functions.admin_activation_rpc_count,
    policies.rogue_offer_policy_count,
    rls.enabled_count as rls_enabled_table_count,
    triggers.booking_guard_trigger_count,
    grants.anon_resolver_execute,
    grants.authenticated_resolver_execute,
    grants.anon_availability_helper_execute,
    grants.anon_batch_execute,
    grants.authenticated_batch_execute,
    grants.service_batch_execute,
    grants.anon_activation_execute,
    grants.authenticated_activation_execute,
    grants.service_activation_execute,
    flags.mapped_enabled as car_multi_city_mapped_enabled,
    flags.threshold_enabled as car_threshold_daily_rates_enabled,
    legacy.offer_count as existing_legacy_offer_count,
    legacy.legacy_compat_mode_count as existing_legacy_compat_mode_count,
    legacy.protected_fingerprint as existing_legacy_protected_fingerprint,
    public_resolution.threshold_id_count_while_flags_off,
    (
      position('submission_status = ''approved''' in coalesce(functions.prerequisite_source, '')) > 0
      and position('stock_count > 0' in coalesce(functions.prerequisite_source, '')) > 0
      and position('owner_partner.can_manage_cars' in coalesce(functions.prerequisite_source, '')) > 0
      and position('min(tier.threshold_days)' in coalesce(functions.prerequisite_source, '')) > 0
      and position('invalid_availability.is_active' in coalesce(functions.prerequisite_source, '')) > 0
      and position('invalid_city.is_active is not true' in coalesce(functions.prerequisite_source, '')) > 0
      and position('pickup_enabled' in coalesce(functions.prerequisite_source, '')) > 0
      and position('return_enabled' in coalesce(functions.prerequisite_source, '')) > 0
    ) as prerequisite_contract_safe,
    (
      position('car_threshold_offer_has_public_prerequisites' in coalesce(functions.route_source, '')) > 0
      and position('pickup_enabled' in coalesce(functions.route_source, '')) > 0
      and position('return_enabled' in coalesce(functions.route_source, '')) > 0
    ) as route_contract_safe,
    (
      position('car_threshold_offer_route_is_public_eligible' in coalesce(functions.booking_guard_source, '')) > 0
      and position('new.status' in coalesce(functions.booking_guard_source, '')) = 0
      and position('new.payment_status' in coalesce(functions.booking_guard_source, '')) = 0
    ) as booking_guard_status_neutral,
    (
      position('car_availability_batch_admin_required' in coalesce(functions.batch_source, '')) > 0
      and position('car_availability_batch_stale_snapshot' in coalesce(functions.batch_source, '')) > 0
      and position('or excluded.pickup_enabled' in coalesce(functions.batch_source, '')) > 0
      and position('or excluded.return_enabled' in coalesce(functions.batch_source, '')) > 0
      and position('desired.pickup_enabled or desired.return_enabled' in coalesce(functions.batch_source, '')) > 0
      and position('delete from public.car_offer_city_availability' in coalesce(functions.batch_source, '')) > 0
      and position('pickup_enabled is distinct from desired.pickup_enabled' in coalesce(functions.batch_source, '')) > 0
      and position('return_enabled is distinct from desired.return_enabled' in coalesce(functions.batch_source, '')) > 0
    ) as admin_batch_contract_safe,
    (
      position('car_threshold_activation_stale_offer' in coalesce(functions.activation_source, '')) > 0
      and position('car_threshold_offer_has_public_prerequisites' in coalesce(functions.activation_source, '')) > 0
      and position('car_threshold_activation_changed_capability_flags' in coalesce(functions.activation_source, '')) > 0
      and position('car_bookings' in coalesce(functions.activation_source, '')) = 0
    ) as admin_activation_contract_safe,
    (
      position('v_pricing_strategy = ''threshold_daily_rate''' in coalesce(functions.partner_resolver_source, '')) > 0
      and position('partner.id = v_exact_owner_id' in coalesce(functions.partner_resolver_source, '')) > 0
      and position('return pid;' in coalesce(functions.partner_resolver_source, '')) > 0
      and position('and v_exact_owner_id is not null then' in coalesce(functions.partner_resolver_source, '')) = 0
    ) as exact_owner_fail_closed_safe,
    (
      position('legacy_compat' in coalesce(policies.public_offer_policy, '')) > 0
      and position('car_threshold_offer_has_public_prerequisites' in coalesce(policies.public_offer_policy, '')) > 0
      and position('is_current_user_admin' in coalesce(policies.authenticated_offer_policy, '')) > 0
      and position('is_partner_user' in coalesce(policies.authenticated_offer_policy, '')) > 0
      and position('legacy_compat' in coalesce(policies.public_availability_policy, '')) > 0
      and position('car_threshold_offer_city_availability_is_public' in coalesce(policies.public_availability_policy, '')) > 0
      and position('car_threshold_offer_has_public_prerequisites' in coalesce(policies.public_tier_policy, '')) > 0
    ) as public_policy_contract_safe,
    (
      functions.prerequisite_helper_count = 1
      and functions.route_helper_count = 1
      and functions.exact_id_resolver_count = 1
      and functions.availability_helper_count = 1
      and functions.admin_batch_rpc_count = 1
      and functions.admin_activation_rpc_count = 1
      and policies.rogue_offer_policy_count = 0
      and rls.enabled_count = 3
      and triggers.booking_guard_trigger_count = 1
      and grants.anon_resolver_execute
      and grants.authenticated_resolver_execute
      and grants.anon_availability_helper_execute
      and grants.anon_batch_execute is false
      and grants.authenticated_batch_execute
      and grants.service_batch_execute
      and grants.anon_activation_execute is false
      and grants.authenticated_activation_execute
      and grants.service_activation_execute
      and flags.settings_row_count = 1
      and flags.both_flags_off_count = 1
      and legacy.offer_count = 27
      and legacy.legacy_compat_mode_count = 27
      and legacy.protected_fingerprint = 'ec3e29a35f249c92279d7b15f400ef0f'
      and public_resolution.threshold_id_count_while_flags_off = 0
      and position('submission_status = ''approved''' in coalesce(functions.prerequisite_source, '')) > 0
      and position('stock_count > 0' in coalesce(functions.prerequisite_source, '')) > 0
      and position('owner_partner.can_manage_cars' in coalesce(functions.prerequisite_source, '')) > 0
      and position('min(tier.threshold_days)' in coalesce(functions.prerequisite_source, '')) > 0
      and position('invalid_availability.is_active' in coalesce(functions.prerequisite_source, '')) > 0
      and position('invalid_city.is_active is not true' in coalesce(functions.prerequisite_source, '')) > 0
      and position('pickup_enabled' in coalesce(functions.prerequisite_source, '')) > 0
      and position('return_enabled' in coalesce(functions.prerequisite_source, '')) > 0
      and position('car_threshold_offer_has_public_prerequisites' in coalesce(functions.route_source, '')) > 0
      and position('pickup_enabled' in coalesce(functions.route_source, '')) > 0
      and position('return_enabled' in coalesce(functions.route_source, '')) > 0
      and position('car_threshold_offer_route_is_public_eligible' in coalesce(functions.booking_guard_source, '')) > 0
      and position('new.status' in coalesce(functions.booking_guard_source, '')) = 0
      and position('new.payment_status' in coalesce(functions.booking_guard_source, '')) = 0
      and position('car_availability_batch_admin_required' in coalesce(functions.batch_source, '')) > 0
      and position('car_availability_batch_stale_snapshot' in coalesce(functions.batch_source, '')) > 0
      and position('or excluded.pickup_enabled' in coalesce(functions.batch_source, '')) > 0
      and position('or excluded.return_enabled' in coalesce(functions.batch_source, '')) > 0
      and position('desired.pickup_enabled or desired.return_enabled' in coalesce(functions.batch_source, '')) > 0
      and position('delete from public.car_offer_city_availability' in coalesce(functions.batch_source, '')) > 0
      and position('car_threshold_activation_stale_offer' in coalesce(functions.activation_source, '')) > 0
      and position('car_threshold_offer_has_public_prerequisites' in coalesce(functions.activation_source, '')) > 0
      and position('car_threshold_activation_changed_capability_flags' in coalesce(functions.activation_source, '')) > 0
      and position('car_bookings' in coalesce(functions.activation_source, '')) = 0
      and position('v_pricing_strategy = ''threshold_daily_rate''' in coalesce(functions.partner_resolver_source, '')) > 0
      and position('partner.id = v_exact_owner_id' in coalesce(functions.partner_resolver_source, '')) > 0
      and position('return pid;' in coalesce(functions.partner_resolver_source, '')) > 0
      and position('and v_exact_owner_id is not null then' in coalesce(functions.partner_resolver_source, '')) = 0
      and position('legacy_compat' in coalesce(policies.public_offer_policy, '')) > 0
      and position('car_threshold_offer_has_public_prerequisites' in coalesce(policies.public_offer_policy, '')) > 0
      and position('is_current_user_admin' in coalesce(policies.authenticated_offer_policy, '')) > 0
      and position('is_partner_user' in coalesce(policies.authenticated_offer_policy, '')) > 0
      and position('legacy_compat' in coalesce(policies.public_availability_policy, '')) > 0
      and position('car_threshold_offer_city_availability_is_public' in coalesce(policies.public_availability_policy, '')) > 0
      and position('car_threshold_offer_has_public_prerequisites' in coalesce(policies.public_tier_policy, '')) > 0
    ) as car_rental_end_to_end_public_eligibility_safe
  from function_state functions
  cross join policy_state policies
  cross join rls_state rls
  cross join trigger_state triggers
  cross join grant_state grants
  cross join flag_state flags
  cross join legacy_state legacy
  cross join public_resolution_state public_resolution
)
select * from summary;
