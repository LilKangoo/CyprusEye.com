\set ON_ERROR_STOP on

\ir hotels-v2-h2a-base.sql
\ir ../../supabase/migrations/20260811170000_hotels_v2_h1a_core.sql
\ir ../../supabase/migrations/20260811200000_hotels_v2_h2a_admin_workspace_foundation.sql
\ir ../../supabase/migrations/20260811210000_hotels_v2_h2a_property_directory_rpc_fix.sql
\ir ../../supabase/migrations/20260811220000_hotels_v2_h2a_legacy_price_visibility.sql

-- Keep this fixture pinned to the deployed partner_resources contract.  An
-- operational assignment is active by row existence; no status column exists.
do $partner_resources_contract$
declare
  v_columns text[];
begin
  select array_agg(column_name::text order by ordinal_position)
  into v_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'partner_resources';

  if v_columns is distinct from array[
    'id', 'partner_id', 'resource_type', 'resource_id', 'created_at'
  ]::text[] then
    raise exception 'hotels_v2_h2a_gate_partner_resources_fixture_drift: %', v_columns;
  end if;
end
$partner_resources_contract$;

do $directory_function_source_contract$
declare
  v_source text;
begin
  select string_agg(lower(pg_get_functiondef(procedure_info.oid)), E'\n')
  into v_source
  from pg_proc procedure_info
  join pg_namespace namespace_info on namespace_info.oid = procedure_info.pronamespace
  where namespace_info.nspname = 'public'
    and procedure_info.proname in (
      'hotel_v2_h2a_readiness',
      'hotel_v2_admin_get_property_list',
      'hotel_v2_admin_get_property_workspace'
    );

  if v_source is null
     or position('assignment.is_active' in v_source) > 0
     or position('''legacy_configuration''' in v_source) = 0 then
    raise exception 'hotels_v2_h2a_gate_property_directory_repair_source_failed';
  end if;
end
$directory_function_source_contract$;

create temporary table hotels_v2_h2a_fixture_protected on commit preserve rows as
select
  (
    select md5(coalesce(string_agg(to_jsonb(hotel)::text, '|' order by hotel.id), ''))
    from public.hotels hotel
    where hotel.id in (
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002'
    )
  ) as hotels_fingerprint,
  (
    select md5(coalesce(string_agg(to_jsonb(booking)::text, '|' order by booking.id), ''))
    from public.hotel_bookings booking
  ) as bookings_fingerprint;

begin;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',
  true
);

do $admin_read_contract$
declare
  v_list jsonb;
  v_assigned_workspace jsonb;
  v_unassigned_workspace jsonb;
begin
  v_list := public.hotel_v2_admin_get_property_list();
  if jsonb_array_length(v_list) <> 2
     or v_list @? '$[*] ? (@.id == "30000000-0000-4000-8000-000000000001" && @.architecture_version == "legacy")' is not true
     or v_list @? '$[*] ? (@.id == "30000000-0000-4000-8000-000000000002" && @.architecture_version == "legacy")' is not true
     or v_list @? '$[*] ? (@.id == "30000000-0000-4000-8000-000000000001" && @.readiness.state == "LEGACY" && @.preparation_state == "DRAFT")' is not true
     or (select count(*) from jsonb_array_elements(v_list) property where (property->>'is_published')::boolean) <> 1
     or v_list @? '$[*] ? (@.id == "30000000-0000-4000-8000-000000000001" && @.operational_partner_count == 1)' is not true
     or v_list @? '$[*] ? (@.id == "30000000-0000-4000-8000-000000000002" && @.operational_partner_count == 0)' is not true
     or v_list @? '$[*] ? (@.id == "30000000-0000-4000-8000-000000000001" && @.legacy_configuration.pricing_model == "tiered_by_nights" && @.legacy_configuration.max_persons == 8)' is not true
     or v_list @? '$[*] ? (@.id == "30000000-0000-4000-8000-000000000002" && @.legacy_configuration.pricing_model == "flat_per_night" && @.legacy_configuration.max_persons == 2)' is not true
     or jsonb_array_length(
       (select property->'legacy_configuration'->'pricing_tiers'->'rules'
        from jsonb_array_elements(v_list) property
        where property->>'id' = '30000000-0000-4000-8000-000000000001')
     ) <> 2
     or jsonb_array_length(
       (select property->'legacy_configuration'->'room_types'
        from jsonb_array_elements(v_list) property
        where property->>'id' = '30000000-0000-4000-8000-000000000001')
     ) <> 1
     or v_list @? '$[*] ? (@.room_type_count == 0 && @.rate_plan_count == 0)' is not true then
    raise exception 'hotels_v2_h2a_gate_property_list_contract_failed';
  end if;

  v_assigned_workspace := public.hotel_v2_admin_get_property_workspace('30000000-0000-4000-8000-000000000001');
  if v_assigned_workspace->'readiness'->>'state' <> 'LEGACY'
     or v_assigned_workspace->>'preparation_state' <> 'DRAFT'
     or jsonb_array_length(v_assigned_workspace->'room_types') <> 0
     or jsonb_array_length(v_assigned_workspace->'amenities_catalogue') <> 2
     or jsonb_array_length(v_assigned_workspace->'partners') <> 1
     or v_assigned_workspace->'partners'->0->>'id' <> '20000000-0000-4000-8000-000000000001'
     or jsonb_array_length(v_assigned_workspace->'operational_partners') <> 1
     or v_assigned_workspace->'operational_partners'->0->>'partner_id' <> '20000000-0000-4000-8000-000000000001'
     or (v_assigned_workspace->'operational_partners'->0->>'is_active')::boolean is not true
     or v_assigned_workspace->'feature_flags' <> jsonb_build_object(
       'hotel_rooms_v2_enabled', false,
       'hotel_external_sync_enabled', false,
       'hotel_instant_booking_enabled', false,
       'hotel_stripe_connect_enabled', false
     )
     or v_assigned_workspace->'payment_due_at_booking'->'default_rule'->>'mode' <> 'per_day'
     or (v_assigned_workspace->>'upcoming_booking_count')::integer <> 1 then
    raise exception 'hotels_v2_h2a_gate_workspace_read_contract_failed';
  end if;

  v_unassigned_workspace := public.hotel_v2_admin_get_property_workspace('30000000-0000-4000-8000-000000000002');
  if v_unassigned_workspace->'property'->>'id' <> '30000000-0000-4000-8000-000000000002'
     or v_unassigned_workspace->'readiness'->>'state' <> 'LEGACY'
     or v_unassigned_workspace->>'preparation_state' <> 'DRAFT'
     or jsonb_array_length(v_unassigned_workspace->'operational_partners') <> 0 then
    raise exception 'hotels_v2_h2a_gate_unassigned_workspace_read_contract_failed';
  end if;
end
$admin_read_contract$;

select public.hotel_v2_admin_create_property_draft(
  '50000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'slug', 'synthetic-rooms-v2-draft',
    'title_i18n', jsonb_build_object('en', 'Synthetic Rooms V2', 'pl', 'Syntetyczny Rooms V2', 'he', 'Rooms V2'),
    'description_i18n', jsonb_build_object('en', 'Synthetic only'),
    'city', 'Ayia Napa',
    'owner_partner_id', '20000000-0000-4000-8000-000000000001',
    'amenities', jsonb_build_array('wifi'),
    'photos', jsonb_build_array('/images/rooms-v2.webp'),
    'timezone', 'Europe/Nicosia',
    'currency', 'EUR'
  ),
  'a0000000-0000-4000-8000-000000000001'
);

do $draft_contract$
declare
  v_property jsonb;
  v_directory_row jsonb;
begin
  v_property := public.hotel_v2_admin_get_property_workspace(
    '50000000-0000-4000-8000-000000000001'
  )->'property';
  if v_property->>'architecture_version' <> 'rooms_v2'
     or v_property->>'booking_mode' <> 'request_confirmation'
     or (v_property->>'is_published')::boolean
     or v_property->>'status' <> 'draft'
     or v_property->>'submission_status' <> 'draft' then
    raise exception 'hotels_v2_h2a_gate_new_property_not_inert';
  end if;

  select property into v_directory_row
  from jsonb_array_elements(public.hotel_v2_admin_get_property_list()) property
  where property->>'id' = '50000000-0000-4000-8000-000000000001';

  if v_directory_row is null
     or v_directory_row->'legacy_configuration' <> 'null'::jsonb then
    raise exception 'hotels_v2_h2a_gate_rooms_v2_received_legacy_configuration';
  end if;
end
$draft_contract$;

-- No older generic Admin write can expose a Rooms V2 draft before H3 installs
-- its controlled public eligibility/search contract.
reset role;
do $rooms_v2_publication_guard$
begin
  begin
    update public.hotels
    set is_published = true
    where id = '50000000-0000-4000-8000-000000000001';
    raise exception 'hotels_v2_h2a_gate_rooms_v2_publication_unexpectedly_succeeded';
  exception when check_violation then
    null;
  end;

  if (select is_published from public.hotels where id = '50000000-0000-4000-8000-000000000001') then
    raise exception 'hotels_v2_h2a_gate_rooms_v2_publication_guard_failed';
  end if;
end
$rooms_v2_publication_guard$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@example.test","role":"authenticated"}',
  true
);

select public.hotel_v2_admin_apply_workspace_plan(
  jsonb_build_object(
    'hotel_id', '50000000-0000-4000-8000-000000000001',
    'reviewed_at', clock_timestamp(),
    'operations', jsonb_build_array(
      jsonb_build_object(
        'entity', 'room_type', 'type', 'create',
        'id', '51000000-0000-4000-8000-000000000001',
        'payload', jsonb_build_object(
          'code', 'deluxe-double',
          'name_i18n', jsonb_build_object('en', 'Deluxe Double', 'pl', 'Pokój Deluxe', 'he', 'דלוקס'),
          'description_i18n', jsonb_build_object('en', 'Synthetic room'),
          'capacity_adults', 2,
          'capacity_children', 1,
          'inventory_mode', 'unitized',
          'base_inventory_count', 0,
          'bed_configuration', jsonb_build_array(
            jsonb_build_object('type', 'king', 'quantity', 1),
            jsonb_build_object('type', 'sofa', 'quantity', 1)
          ),
          'amenities', jsonb_build_array('wifi', 'air-conditioning'),
          'status', 'active'
        )
      ),
      jsonb_build_object(
        'entity', 'unit', 'type', 'create',
        'id', '52000000-0000-4000-8000-000000000001',
        'payload', jsonb_build_object(
          'room_type_id', '51000000-0000-4000-8000-000000000001',
          'code', 'room-101',
          'name_i18n', jsonb_build_object('en', 'Room 101'),
          'status', 'active'
        )
      ),
      jsonb_build_object(
        'entity', 'rate_plan', 'type', 'create',
        'id', '53000000-0000-4000-8000-000000000001',
        'payload', jsonb_build_object(
          'code', 'standard-flexible',
          'name_i18n', jsonb_build_object('en', 'Standard Flexible', 'pl', 'Standard elastyczny'),
          'description_i18n', jsonb_build_object('en', 'Synthetic flexible plan'),
          'meal_plan_code', 'room_only',
          'cancellation_policy', jsonb_build_object('type', 'flexible'),
          'is_active', true
        )
      ),
      jsonb_build_object(
        'entity', 'room_rate', 'type', 'create',
        'id', '54000000-0000-4000-8000-000000000001',
        'payload', jsonb_build_object(
          'room_type_id', '51000000-0000-4000-8000-000000000001',
          'rate_plan_id', '53000000-0000-4000-8000-000000000001',
          'base_nightly_rate', 120,
          'currency', 'EUR',
          'is_active', true
        )
      )
    )
  ),
  'a0000000-0000-4000-8000-000000000002'
);

do $ready_contract$
declare
  v_workspace jsonb;
begin
  v_workspace := public.hotel_v2_admin_get_property_workspace('50000000-0000-4000-8000-000000000001');
  if v_workspace->'readiness'->>'state' <> 'READY_FOR_CALENDAR'
     or (v_workspace->'readiness'->>'configured_inventory')::integer <> 1
     or jsonb_array_length(v_workspace->'room_types') <> 1
     or jsonb_array_length(v_workspace->'units') <> 1
     or jsonb_array_length(v_workspace->'rate_plans') <> 1
     or jsonb_array_length(v_workspace->'room_rates') <> 1
     or (select count(*) from public.hotel_activity_log where correlation_id = 'a0000000-0000-4000-8000-000000000002') <> 4 then
    raise exception 'hotels_v2_h2a_gate_ready_workspace_contract_failed';
  end if;
end
$ready_contract$;

-- Duplicate creates one independent draft Room Type.  Units and sellable
-- products are deliberately not copied implicitly.
select public.hotel_v2_admin_apply_workspace_plan(
  jsonb_build_object(
    'hotel_id', '50000000-0000-4000-8000-000000000001',
    'operations', jsonb_build_array(jsonb_build_object(
      'entity', 'room_type', 'type', 'duplicate',
      'id', '51000000-0000-4000-8000-000000000002',
      'expected_version', 1,
      'payload', jsonb_build_object(
        'source_id', '51000000-0000-4000-8000-000000000001',
        'code', 'deluxe-double-copy',
        'name_i18n', jsonb_build_object('en', 'Deluxe Double Copy')
      )
    ))
  ),
  'a0000000-0000-4000-8000-000000000003'
);

do $duplicate_contract$
begin
  if not exists (
    select 1 from public.hotel_room_types
    where id = '51000000-0000-4000-8000-000000000002'
      and status = 'draft'
      and version = 1
  )
  or exists (
    select 1 from public.hotel_units
    where room_type_id = '51000000-0000-4000-8000-000000000002'
  )
  or exists (
    select 1 from public.hotel_room_rates
    where room_type_id = '51000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'hotels_v2_h2a_gate_room_duplicate_not_safe';
  end if;
end
$duplicate_contract$;

-- Every stale target is checked before the first mutation.  The valid room
-- update below must not execute when the second reviewed entity is stale.
do $stale_atomic$
declare
  v_before_version bigint;
  v_before_name jsonb;
begin
  select version, name_i18n into v_before_version, v_before_name
  from public.hotel_room_types where id = '51000000-0000-4000-8000-000000000001';

  begin
    perform public.hotel_v2_admin_apply_workspace_plan(
      jsonb_build_object(
        'hotel_id', '50000000-0000-4000-8000-000000000001',
        'operations', jsonb_build_array(
          jsonb_build_object(
            'entity', 'room_type', 'type', 'update',
            'id', '51000000-0000-4000-8000-000000000001',
            'expected_version', v_before_version,
            'payload', jsonb_build_object('name_i18n', jsonb_build_object('en', 'Must roll back'))
          ),
          jsonb_build_object(
            'entity', 'rate_plan', 'type', 'update',
            'id', '53000000-0000-4000-8000-000000000001',
            'expected_version', 999,
            'payload', jsonb_build_object('name_i18n', jsonb_build_object('en', 'Stale'))
          )
        )
      ),
      'a0000000-0000-4000-8000-000000000004'
    );
    raise exception 'hotels_v2_h2a_gate_stale_plan_unexpectedly_succeeded';
  exception when serialization_failure then
    null;
  end;

  if exists (
    select 1 from public.hotel_room_types
    where id = '51000000-0000-4000-8000-000000000001'
      and (version <> v_before_version or name_i18n <> v_before_name)
  ) or exists (
    select 1 from public.hotel_activity_log
    where correlation_id = 'a0000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'hotels_v2_h2a_gate_stale_plan_partially_mutated';
  end if;
end
$stale_atomic$;

do $invalid_atomic$
begin
  begin
    perform public.hotel_v2_admin_apply_workspace_plan(
      jsonb_build_object(
        'hotel_id', '50000000-0000-4000-8000-000000000001',
        'operations', jsonb_build_array(jsonb_build_object(
          'entity', 'room_type', 'type', 'create',
          'id', '51000000-0000-4000-8000-000000000099',
          'payload', jsonb_build_object(
            'code', 'invalid-capacity',
            'name_i18n', jsonb_build_object('en', 'Invalid'),
            'capacity_adults', 0
          )
        ))
      ),
      'a0000000-0000-4000-8000-000000000005'
    );
    raise exception 'hotels_v2_h2a_gate_invalid_capacity_unexpectedly_succeeded';
  exception when check_violation then
    null;
  end;

  if exists (select 1 from public.hotel_room_types where id = '51000000-0000-4000-8000-000000000099')
     or exists (select 1 from public.hotel_activity_log where correlation_id = 'a0000000-0000-4000-8000-000000000005') then
    raise exception 'hotels_v2_h2a_gate_invalid_plan_partially_mutated';
  end if;
end
$invalid_atomic$;

do $same_property_contract$
begin
  begin
    perform public.hotel_v2_admin_apply_workspace_plan(
      jsonb_build_object(
        'hotel_id', '30000000-0000-4000-8000-000000000001',
        'operations', jsonb_build_array(jsonb_build_object(
          'entity', 'room_rate', 'type', 'create',
          'id', '54000000-0000-4000-8000-000000000099',
          'payload', jsonb_build_object(
            'room_type_id', '51000000-0000-4000-8000-000000000001',
            'rate_plan_id', '53000000-0000-4000-8000-000000000001',
            'base_nightly_rate', 1
          )
        ))
      ),
      'a0000000-0000-4000-8000-000000000006'
    );
    raise exception 'hotels_v2_h2a_gate_cross_property_product_unexpectedly_succeeded';
  exception when foreign_key_violation then
    null;
  end;
end
$same_property_contract$;

-- Exact versioned edits for Unit, Rate Plan and Room Rate.
select public.hotel_v2_admin_apply_workspace_plan(
  jsonb_build_object(
    'hotel_id', '50000000-0000-4000-8000-000000000001',
    'operations', jsonb_build_array(
      jsonb_build_object(
        'entity', 'unit', 'type', 'update',
        'id', '52000000-0000-4000-8000-000000000001', 'expected_version', 1,
        'payload', jsonb_build_object('name_i18n', jsonb_build_object('en', 'Room 101 East'))
      ),
      jsonb_build_object(
        'entity', 'rate_plan', 'type', 'update',
        'id', '53000000-0000-4000-8000-000000000001', 'expected_version', 1,
        'payload', jsonb_build_object(
          'cancellation_policy', jsonb_build_object(
            'type', 'custom', 'deadline_hours', 48,
            'penalty_mode', 'percent', 'penalty_value', 50
          )
        )
      ),
      jsonb_build_object(
        'entity', 'room_rate', 'type', 'update',
        'id', '54000000-0000-4000-8000-000000000001', 'expected_version', 1,
        'payload', jsonb_build_object('base_nightly_rate', 125)
      )
    )
  ),
  'a0000000-0000-4000-8000-000000000007'
);

do $versioned_edit_contract$
begin
  if (select version from public.hotel_units where id = '52000000-0000-4000-8000-000000000001') <> 2
     or (select version from public.hotel_rate_plans where id = '53000000-0000-4000-8000-000000000001') <> 2
     or (select version from public.hotel_room_rates where id = '54000000-0000-4000-8000-000000000001') <> 2
     or (select base_nightly_rate from public.hotel_room_rates where id = '54000000-0000-4000-8000-000000000001') <> 125 then
    raise exception 'hotels_v2_h2a_gate_versioned_edit_contract_failed';
  end if;
end
$versioned_edit_contract$;

-- A unitized room with physical units cannot silently become pooled.
do $inventory_mode_guard$
begin
  begin
    perform public.hotel_v2_admin_apply_workspace_plan(
      jsonb_build_object(
        'hotel_id', '50000000-0000-4000-8000-000000000001',
        'operations', jsonb_build_array(jsonb_build_object(
          'entity', 'room_type', 'type', 'update',
          'id', '51000000-0000-4000-8000-000000000001', 'expected_version', 1,
          'payload', jsonb_build_object('inventory_mode', 'pooled')
        ))
      ),
      'a0000000-0000-4000-8000-000000000008'
    );
    raise exception 'hotels_v2_h2a_gate_inventory_mode_conversion_unexpectedly_succeeded';
  exception when check_violation then
    null;
  end;
end
$inventory_mode_guard$;

-- Non-Admin authenticated users retain zero raw normalized access and cannot
-- invoke any Admin SECURITY DEFINER entry point.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","email":"partner@example.test","role":"authenticated"}',
  true
);

do $partner_denied$
begin
  if (select count(*) from public.hotel_room_types) <> 0
     or (select count(*) from public.hotel_activity_log) <> 0 then
    raise exception 'hotels_v2_h2a_gate_partner_raw_read_unexpectedly_allowed';
  end if;

  begin
    perform public.hotel_v2_admin_get_property_list();
    raise exception 'hotels_v2_h2a_gate_partner_admin_rpc_unexpectedly_allowed';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.hotel_room_types(
      hotel_id, code, name_i18n, capacity_adults
    ) values (
      '30000000-0000-4000-8000-000000000001',
      'forbidden-direct-write',
      '{"en":"Forbidden"}',
      1
    );
    raise exception 'hotels_v2_h2a_gate_partner_direct_write_unexpectedly_allowed';
  exception when insufficient_privilege then
    null;
  end;
end
$partner_denied$;

reset role;

do $grant_contract$
begin
  if has_function_privilege('anon', 'public.hotel_v2_admin_get_property_list()', 'EXECUTE')
     or has_function_privilege('anon', 'public.hotel_v2_admin_get_property_workspace(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)', 'EXECUTE')
     or has_table_privilege('anon', 'public.hotel_activity_log', 'SELECT')
     or has_table_privilege('authenticated', 'public.hotel_activity_log', 'INSERT')
     or not has_table_privilege('service_role', 'public.hotel_room_types', 'SELECT') then
    raise exception 'hotels_v2_h2a_gate_grant_contract_failed';
  end if;
end
$grant_contract$;

do $inert_and_legacy_contract$
declare
  v_original hotels_v2_h2a_fixture_protected%rowtype;
  v_current text;
begin
  select * into v_original from hotels_v2_h2a_fixture_protected;

  if exists (
    select 1 from public.site_settings
    where hotel_rooms_v2_enabled
       or hotel_external_sync_enabled
       or hotel_instant_booking_enabled
       or hotel_stripe_connect_enabled
  ) then
    raise exception 'hotels_v2_h2a_gate_feature_flag_changed';
  end if;

  select md5(coalesce(string_agg(to_jsonb(hotel)::text, '|' order by hotel.id), ''))
  into v_current
  from public.hotels hotel
  where hotel.id in (
    '30000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002'
  );
  if v_current is distinct from v_original.hotels_fingerprint then
    raise exception 'hotels_v2_h2a_gate_existing_legacy_properties_changed';
  end if;

  select md5(coalesce(string_agg(to_jsonb(booking)::text, '|' order by booking.id), ''))
  into v_current from public.hotel_bookings booking;
  if v_current is distinct from v_original.bookings_fingerprint then
    raise exception 'hotels_v2_h2a_gate_existing_bookings_changed';
  end if;
end
$inert_and_legacy_contract$;

select
  true as admin_property_list_pass,
  true as workspace_snapshot_pass,
  true as property_directory_repair_pass,
  true as rooms_rates_plan_pass,
  true as exact_version_pass,
  true as atomic_stale_abort_pass,
  true as same_property_pass,
  true as rls_pass,
  true as legacy_unchanged_pass,
  true as hotels_v2_h2a_postgres_gate_safe;

rollback;
