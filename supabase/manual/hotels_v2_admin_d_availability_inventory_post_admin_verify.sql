-- Hotels V2 ADMIN-D post-Admin verification.
-- READ ONLY. Supabase Dashboard SQL Editor compatible.
-- Compare protected_relation_fingerprints byte-for-byte with preflight output.

with protected as(select public.hotel_v2_admin_d_protected_fingerprints() value),
d_state as(select jsonb_build_object(
  'hotel_daily_inventory',md5(pg_catalog.query_to_xml('select to_jsonb(row_value)::text from public.hotel_daily_inventory row_value order by row_value.room_type_id,row_value.stay_date',true,true,'')::text),
  'hotel_unit_calendar_blocks',md5(pg_catalog.query_to_xml('select to_jsonb(row_value)::text from public.hotel_unit_calendar_blocks row_value order by row_value.id',true,true,'')::text),
  'hotel_inventory_day_locks',md5(pg_catalog.query_to_xml('select to_jsonb(row_value)::text from public.hotel_inventory_day_locks row_value order by row_value.room_type_id,row_value.stay_date',true,true,'')::text),
  'hotel_inventory_holds',md5(pg_catalog.query_to_xml('select to_jsonb(row_value)::text from public.hotel_inventory_holds row_value order by row_value.id',true,true,'')::text),
  'hotel_booking_room_allocations',md5(pg_catalog.query_to_xml('select to_jsonb(row_value)::text from public.hotel_booking_room_allocations row_value order by row_value.id',true,true,'')::text),
  'hotel_inventory_commitments',md5(pg_catalog.query_to_xml('select to_jsonb(row_value)::text from public.hotel_inventory_commitments row_value order by row_value.id',true,true,'')::text),
  'hotel_rate_rule_availability',md5(pg_catalog.query_to_xml('select id,availability_version,availability_reason,availability_actor_id,availability_correlation_id,availability_updated_at from public.hotel_rate_rules order by id',true,true,'')::text),
  'hotel_exact_availability',md5(pg_catalog.query_to_xml('select id,closed,closed_mode,closed_to_arrival,closed_to_arrival_mode,closed_to_departure,closed_to_departure_mode,availability_active,availability_expires_at,availability_version,availability_reason,availability_actor_id,availability_correlation_id,availability_updated_at from public.hotel_calendar_overrides order by id',true,true,'')::text),
  'hotel_admin_availability_action_receipts',md5(pg_catalog.query_to_xml('select to_jsonb(row_value)::text from public.hotel_admin_availability_action_receipts row_value order by row_value.actor_id,row_value.idempotency_key',true,true,'')::text),
  'hotel_admin_availability_plan_reviews',md5(pg_catalog.query_to_xml('select to_jsonb(row_value)::text from public.hotel_admin_availability_plan_reviews row_value order by row_value.actor_id,row_value.plan_fingerprint',true,true,'')::text),
  'hotel_admin_d_activity',md5(pg_catalog.query_to_xml($query$select to_jsonb(row_value)::text from public.hotel_activity_log row_value where source='hotels_v2_admin_d_availability_control' order by row_value.id$query$,true,true,'')::text)
  ) value),
security as(select not exists(select 1 from unnest(array['hotel_unit_calendar_blocks','hotel_inventory_day_locks',
      'hotel_inventory_holds','hotel_booking_room_allocations','hotel_inventory_commitments',
      'hotel_admin_availability_action_receipts','hotel_admin_availability_plan_reviews',
      'hotel_admin_availability_foundation_receipts']) relation_name(name)
    cross join unnest(array['anon','authenticated','service_role']) role_name(name)
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name(name)
    where has_table_privilege(role_name.name,'public.'||relation_name.name,privilege_name.name))
  and not exists(select 1 from unnest(array['hotel_room_types','hotel_units','hotel_rate_plans',
      'hotel_room_rates','hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates',
      'hotel_calendar_overrides']) relation_name(name)
    cross join unnest(array['anon','authenticated']) role_name(name)
    cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name(name)
    where has_table_privilege(role_name.name,'public.'||relation_name.name,privilege_name.name))
  and not exists(select 1 from (values
      ('public.hotel_v2_admin_d_keys_allowed(jsonb,text[])',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_protected_fingerprints()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_hash(jsonb)',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_uuid_is_canonical(text)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_deterministic_uuid(text)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_reason_is_valid(jsonb)',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_json_dates_are_canonical(jsonb)',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_shared_availability_fields()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_audit_state(text,jsonb)',false,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_immutable_row()',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_plan_review_consume_guard()',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_validate_unit_block()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_allocation()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_commitment()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_allocation_topology()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_hold_topology()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_hold_update()',false,array['search_path=pg_catalog']::text[]),
      ('public.hotel_v2_admin_d_validate_room_availability_change()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_validate_unit_availability_change()',true,array['search_path=pg_catalog, public']::text[]),
      ('public.hotel_v2_admin_d_snapshot(uuid,date,date,boolean)',true,array['search_path=pg_catalog, public, auth']::text[]),
      ('public.hotel_v2_admin_d_review_plan(jsonb)',true,array['search_path=pg_catalog, public, auth']::text[])
    ) expected(signature,security_definer,configuration)
    left join pg_proc p on p.oid=to_regprocedure(expected.signature)
    where p.oid is null or p.proowner<>(select oid from pg_roles where rolname='postgres')
      or p.prosecdef is distinct from expected.security_definer or p.proconfig is distinct from expected.configuration)
  and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and left(p.proname,length('hotel_v2_admin_d_'))='hotel_v2_admin_d_'
      and (has_function_privilege(0::oid,p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE')
        or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE')))
  and not exists(select 1 from unnest(array[
      'hotel_rate_rules_admin_d_availability_guard','hotel_calendar_overrides_admin_d_availability_guard',
      'hotel_unit_calendar_blocks_admin_d_guard','hotel_booking_room_allocations_admin_d_guard',
      'hotel_inventory_commitments_admin_d_guard','hotel_inventory_holds_admin_d_guard',
      'hotel_booking_room_allocations_admin_d_topology','hotel_inventory_commitments_admin_d_allocation_topology',
      'hotel_inventory_holds_admin_d_topology','hotel_inventory_commitments_admin_d_hold_topology',
      'hotel_room_types_admin_d_capacity_guard','hotel_units_admin_d_capacity_guard',
      'hotel_admin_availability_receipts_immutable','hotel_admin_availability_reviews_no_delete',
      'hotel_admin_availability_reviews_consume_guard','hotel_admin_availability_foundation_immutable',
      'hotel_unit_calendar_blocks_no_delete','hotel_inventory_holds_no_delete',
      'hotel_booking_room_allocations_no_delete','hotel_inventory_commitments_no_delete']) expected(trigger_name)
    where not exists(select 1 from pg_trigger where tgname=expected.trigger_name and not tgisinternal))
  and not exists(select 1 from unnest(array[
      'public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)',
      'public.hotel_v2_admin_resolve_rate(uuid,date,date,integer)',
      'public.hotel_v2_admin_get_calendar(uuid,date,date)']) legacy(signature)
    cross join (values(0::oid),('anon'::regrole::oid),
      ('authenticated'::regrole::oid),('service_role'::regrole::oid)) role_name(role_oid)
    where has_function_privilege(role_name.role_oid,legacy.signature,'EXECUTE'))
  and not exists(select 1 from (values
      ('public.hotel_v2_admin_get_availability_control(uuid,date,date)'),
      ('public.hotel_v2_admin_preview_availability_plan(jsonb)'),
      ('public.hotel_v2_admin_apply_availability_control_plan(jsonb,uuid,text)'),
      ('public.hotel_v2_admin_preview_stay(jsonb)')) expected(signature)
    left join pg_proc p on p.oid=to_regprocedure(expected.signature)
    where p.oid is null or p.proowner<>(select oid from pg_roles where rolname='postgres')
      or not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog, public, auth']::text[]
      or has_function_privilege(0::oid,p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('service_role',p.oid,'EXECUTE')
      or not has_function_privilege('authenticated',p.oid,'EXECUTE')) value),
ledger as(select not exists(
    select 1 from public.hotel_admin_availability_action_receipts receipt
    left join public.hotel_admin_availability_plan_reviews review
      on review.correlation_id=receipt.correlation_id and review.actor_id=receipt.actor_id
    where review.actor_id is null or review.consumed_at is null or review.hotel_id<>receipt.hotel_id
      or receipt.request_hash<>public.hotel_v2_admin_d_hash(jsonb_build_object('plan',review.reviewed_plan,
        'correlation_id',receipt.correlation_id,'idempotency_key',receipt.idempotency_key))
      or receipt.result->>'correlation_id' is distinct from receipt.correlation_id::text
      or receipt.result->>'hotel_id' is distinct from receipt.hotel_id::text
      or receipt.result->>'idempotency_key' is distinct from receipt.idempotency_key
      or jsonb_typeof(receipt.result->'activity')<>'array'
      or jsonb_array_length(receipt.result->'activity')<>jsonb_array_length(review.reviewed_plan->'operations')
      or jsonb_array_length(receipt.result->'activity')<>(select count(distinct item.value->>'id')
        from jsonb_array_elements(receipt.result->'activity') item(value))
      or exists(select 1 from jsonb_array_elements(receipt.result->'activity') item(value)
        left join public.hotel_activity_log activity on activity.id=(item.value->>'id')::uuid
        where activity.id is null or activity.hotel_id<>receipt.hotel_id
          or activity.correlation_id<>receipt.correlation_id
          or activity.actor_id<>receipt.actor_id or activity.actor_type<>'admin'
          or activity.source<>'hotels_v2_admin_d_availability_control'
          or item.value is distinct from jsonb_build_object('id',activity.id,'entity_type',activity.entity_type,
            'entity_id',activity.entity_id,'action',activity.action,
            'before_state',case when activity.before_state is null then null else jsonb_build_object(
              'fingerprint',public.hotel_v2_admin_d_hash(activity.before_state),'redacted',true) end,
            'after_state',case when activity.after_state is null then null else jsonb_build_object(
              'fingerprint',public.hotel_v2_admin_d_hash(activity.after_state),'redacted',true) end,
            'actor_type','admin','source','hotels_v2_admin_d_availability_control',
            'correlation_id',activity.correlation_id,'created_at',activity.created_at))
      or exists(select 1 from jsonb_array_elements(review.reviewed_plan->'operations') operation(value)
        where not exists(select 1 from jsonb_array_elements(receipt.result->'activity') item(value)
          where item.value->>'entity_type'=case when operation.value->>'entity'='operational_override' then 'calendar_override'
              when operation.value->>'entity'='hold' then 'inventory_hold' else operation.value->>'entity' end
            and item.value->>'entity_id'=case when operation.value->>'entity'='daily_inventory' then
              public.hotel_v2_admin_d_deterministic_uuid((operation.value#>>'{payload,room_type_id}')||':'||
                (operation.value#>>'{payload,stay_date}'))::text else operation.value->>'id' end
            and item.value->>'action'=case
              when operation.value->>'entity'='daily_inventory' and operation.value->>'action'='delete' then 'delete'
              when operation.value->>'entity'='daily_inventory' and operation.value->>'action'='upsert'
                and (operation.value->>'expected_version')::bigint=0 then 'create'
              when operation.value->>'action' in('create','map') then 'create'
              when operation.value->>'action' in('disable','release','clear') then 'disable'
              else 'update' end))
  ) and not exists(
    select 1 from public.hotel_activity_log activity
    where activity.source='hotels_v2_admin_d_availability_control' and not exists(
      select 1 from public.hotel_admin_availability_action_receipts receipt,
        lateral jsonb_array_elements(receipt.result->'activity') item(value)
      where receipt.correlation_id=activity.correlation_id and item.value->>'id'=activity.id::text)
  ) value),
diagnostics as(select
  case when (public.hotel_v2_h3_1p_pricing_promotion_snapshot('9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{parity,total_case_count}')::integer=70
    and (public.hotel_v2_h3_1p_pricing_promotion_snapshot('9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{parity,total_mismatch_count}')::integer=0 then 0 else 1 end occupancy_mismatch,
  case when exists(select 1 from public.hotels where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
    and architecture_version='legacy' and md5(pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03') then 0 else 1 end legacy_price_mismatch,
  case when (select count(*) from public.site_settings)=1 and exists(select 1 from public.site_settings where id=1
    and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled and not hotel_instant_booking_enabled
    and not hotel_stripe_connect_enabled) then 0 else 1 end public_mismatch,
  case when exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt
    where receipt.id=1
      and receipt.protected_fingerprints->'hotel_bookings'=public.hotel_v2_admin_d_protected_fingerprints()->'hotel_bookings'
      and receipt.protected_fingerprints->'partner_service_fulfillments'=public.hotel_v2_admin_d_protected_fingerprints()->'partner_service_fulfillments'
      and receipt.protected_fingerprints->'partner_service_fulfillment_form_snapshots'=public.hotel_v2_admin_d_protected_fingerprints()->'partner_service_fulfillment_form_snapshots'
      and receipt.protected_fingerprints->'service_deposit_requests'=public.hotel_v2_admin_d_protected_fingerprints()->'service_deposit_requests'
      and receipt.protected_fingerprints->'service_coupon_redemptions'=public.hotel_v2_admin_d_protected_fingerprints()->'service_coupon_redemptions')
    then 0 else 1 end booking_mismatch,
  exists(select 1 from public.hotel_admin_availability_foundation_receipts receipt where receipt.id=1
    and receipt.protected_fingerprints=public.hotel_v2_admin_d_protected_fingerprints()
    and receipt.protected_fingerprint=encode(extensions.digest(convert_to(receipt.protected_fingerprints::text,'UTF8'),'sha256'),'hex')) protected_ok),
verdict as(select diagnostics.occupancy_mismatch=0 and diagnostics.legacy_price_mismatch=0
    and diagnostics.public_mismatch=0 and diagnostics.booking_mismatch=0
    and diagnostics.protected_ok and ledger.value and security.value value
  from diagnostics cross join ledger cross join security)
select protected.value protected_relation_fingerprints,d_state.value reviewed_admin_state_fingerprints,
  diagnostics.occupancy_mismatch as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  diagnostics.legacy_price_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  diagnostics.public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  diagnostics.booking_mismatch as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  case when verdict.value then true else
    format('HOTELS_V2_ADMIN_D_POST_ADMIN_VERIFY_FAILED_%s',clock_timestamp())::boolean end
    as hotels_v2_admin_d_availability_inventory_post_admin_safe
from protected cross join d_state cross join diagnostics cross join verdict;
