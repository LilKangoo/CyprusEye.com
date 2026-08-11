-- Hotels 2.0 H2B.1 reviewed-policy repair verification.
-- READ ONLY. Run after 20260811250000_hotels_v2_h2b1_shadow_policy_review_fix.sql.

with
rpc as (
  select
    count(*)::integer function_count,
    count(*) filter(where procedure_info.prosecdef)::integer security_definer_count,
    count(*) filter(where procedure_info.provolatile='v')::integer volatile_count,
    count(*) filter(where procedure_info.proconfig @> array['search_path=pg_catalog, public, auth'])::integer safe_search_path_count,
    count(*) filter(where pg_get_functiondef(procedure_info.oid) like '%expected_property_policy%'
      and pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b1_stale_property_policy%'
      and pg_get_functiondef(procedure_info.oid) like '%children_policy is not distinct from v_expected_policy_value%'
      and pg_get_functiondef(procedure_info.oid) like '%minimum_child_age is not distinct from v_expected_minimum_age%'
      and pg_get_functiondef(procedure_info.oid) like '%hotels_v2_h2b1_unexpected_existing_room_type%'
      and pg_get_functiondef(procedure_info.oid) like '%perform public.hotel_v2_h2a_require_admin()%'
      and pg_get_functiondef(procedure_info.oid) not like '%hotels_v2_h2b1_guest_policy_already_reviewed%'
    )::integer reviewed_snapshot_contract_count,
    count(*) filter(where has_function_privilege('authenticated',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('anon',procedure_info.oid,'EXECUTE')
      and not has_function_privilege('service_role',procedure_info.oid,'EXECUTE')
      and not exists(select 1
        from aclexplode(coalesce(procedure_info.proacl,acldefault('f',procedure_info.proowner))) privilege
        where privilege.grantee=0 and privilege.privilege_type='EXECUTE')
    )::integer exact_grant_count
  from pg_proc procedure_info
  join pg_namespace function_schema on function_schema.oid=procedure_info.pronamespace
  where function_schema.nspname='public'
    and procedure_info.proname='hotel_v2_admin_prepare_legacy_shadow_rooms'
    and pg_get_function_identity_arguments(procedure_info.oid)='p_plan jsonb, p_correlation_id uuid'
),
property as (
  select count(*)::integer property_count,
    count(*) filter(where architecture_version='legacy')::integer legacy_count,
    count(*) filter(where children_policy is null
      or (children_policy in ('allowed','not_allowed') and minimum_child_age is null)
      or (children_policy='minimum_age' and minimum_child_age between 0 and 17)
    )::integer valid_policy_count
  from public.hotels
  where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
),
rooms as (
  select count(*)::integer room_count,
    count(*) filter(where id in (
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
      '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
    ))::integer deterministic_room_count,
    count(*) filter(where id not in (
      'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,
      '825c01b7-9f82-492a-9c81-9b1d5cd7acd3'::uuid
    ))::integer unexpected_room_count,
    count(*) filter(where status in ('draft','active'))::integer safe_status_count
  from public.hotel_room_types
  where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
),
plans as (
  select count(*)::integer plan_count,
    count(*) filter(where not is_active)::integer inactive_plan_count
  from public.hotel_rate_plans
  where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    and id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'::uuid
),
rates as (
  select count(*)::integer rate_count,
    count(*) filter(where not is_active)::integer inactive_rate_count
  from public.hotel_room_rates
  where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    and id in (
      '7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,
      '3320590d-632d-423f-80d0-fd021cba7293'::uuid
    )
),
schedules as (
  select count(*)::integer schedule_count,
    count(*) filter(where not is_active and review_status='requires_review')::integer inert_schedule_count
  from public.hotel_pricing_schedules
  where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
    and id in (
      'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid,
      '443065c0-984a-5de3-a22a-d03042c41107'::uuid
    )
),
flags as (
  select count(*)::integer settings_count,
    count(*) filter(where not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
      and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)::integer flags_off_count
  from public.site_settings
),
history as (
  select
    (select count(*)::integer from public.hotel_bookings) booking_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.hotel_bookings row_value) booking_fingerprint,
    (select count(*)::integer from public.partner_service_fulfillments where resource_type='hotels') fulfillment_count,
    (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|' order by row_value.id),''))
      from public.partner_service_fulfillments row_value where row_value.resource_type='hotels') fulfillment_fingerprint
)
select
  rpc.function_count,rpc.security_definer_count,rpc.volatile_count,
  rpc.safe_search_path_count,rpc.reviewed_snapshot_contract_count,rpc.exact_grant_count,
  property.property_count,property.legacy_count,property.valid_policy_count,
  rooms.room_count,rooms.deterministic_room_count,rooms.unexpected_room_count,rooms.safe_status_count,
  plans.plan_count,plans.inactive_plan_count,
  rates.rate_count,rates.inactive_rate_count,
  schedules.schedule_count,schedules.inert_schedule_count,
  flags.flags_off_count,
  history.booking_count,history.booking_fingerprint,
  history.fulfillment_count,history.fulfillment_fingerprint,
  (
    rpc.function_count=1 and rpc.security_definer_count=1 and rpc.volatile_count=1
    and rpc.safe_search_path_count=1 and rpc.reviewed_snapshot_contract_count=1 and rpc.exact_grant_count=1
    and property.property_count=1 and property.legacy_count=1 and property.valid_policy_count=1
    and rooms.unexpected_room_count=0
    and rooms.deterministic_room_count in (0,2)
    and rooms.safe_status_count=rooms.room_count
    and plans.inactive_plan_count=plans.plan_count
    and rates.inactive_rate_count=rates.rate_count
    and schedules.inert_schedule_count=schedules.schedule_count
    and flags.settings_count=1 and flags.flags_off_count=1
    and history.booking_count=3 and history.booking_fingerprint='fb5a4c508b0df32afbffe5b1594c7a50'
    and history.fulfillment_count=5 and history.fulfillment_fingerprint='1e01541853d87d26adccb8172074934b'
  ) hotels_v2_h2b1_shadow_policy_review_fix_safe
from rpc cross join property cross join rooms cross join plans cross join rates
cross join schedules cross join flags cross join history;
