-- Hotels 2.0 H1A post-migration verification (READ ONLY).
-- Run after, in order:
--   20260811140000_hotels_live_schema_reconciliation.sql
--   20260811150000_hotels_v2_h1a_partner_security_bridge.sql
--   20260811170000_hotels_v2_h1a_core.sql
--   20260811180000_hotels_v2_h1a_booking_security_lockdown.sql
--
-- Returns exactly one summary row.  No data is written.

with
expected_property_ids(id) as (
  values
    ('9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid),
    ('f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid)
),
expected_booking_ids(id) as (
  values
    ('1f1bef2f-ba2b-4d6c-9c43-8714e0224bd1'::uuid),
    ('a2377882-4959-45ac-b311-3eb16afaa01d'::uuid),
    ('a509b9da-9fd6-4836-8525-1068e23303ca'::uuid)
),
expected_fulfillment_ids(id) as (
  values
    ('21114c8e-7d5c-4136-af18-a93ebd315618'::uuid),
    ('87dbd568-bd83-4bb1-9493-0c4942b7fb18'::uuid),
    ('aff7d13a-960f-48e3-8d93-72205ee18e76'::uuid),
    ('b981fda1-4879-49ec-b499-16161bafe1c1'::uuid),
    ('c857644b-2094-41eb-96d9-f735cdb681a4'::uuid)
),
expected_normalized_columns(table_name, column_name, formatted_type, not_null) as (
  values
    ('hotel_room_types','id','uuid',true),
    ('hotel_room_types','hotel_id','uuid',true),
    ('hotel_room_types','code','text',true),
    ('hotel_room_types','name_i18n','jsonb',true),
    ('hotel_room_types','description_i18n','jsonb',true),
    ('hotel_room_types','gallery','jsonb',true),
    ('hotel_room_types','capacity_adults','smallint',true),
    ('hotel_room_types','capacity_children','smallint',true),
    ('hotel_room_types','bed_configuration','jsonb',true),
    ('hotel_room_types','bathrooms','numeric(4,1)',false),
    ('hotel_room_types','size_sqm','numeric(8,2)',false),
    ('hotel_room_types','amenities','text[]',true),
    ('hotel_room_types','inventory_mode','text',true),
    ('hotel_room_types','base_inventory_count','integer',true),
    ('hotel_room_types','status','text',true),
    ('hotel_room_types','sort_order','integer',true),
    ('hotel_room_types','version','bigint',true),
    ('hotel_room_types','created_at','timestamp with time zone',true),
    ('hotel_room_types','updated_at','timestamp with time zone',true),
    ('hotel_units','id','uuid',true),
    ('hotel_units','room_type_id','uuid',true),
    ('hotel_units','code','text',true),
    ('hotel_units','name_i18n','jsonb',true),
    ('hotel_units','status','text',true),
    ('hotel_units','version','bigint',true),
    ('hotel_units','created_at','timestamp with time zone',true),
    ('hotel_units','updated_at','timestamp with time zone',true),
    ('hotel_rate_plans','id','uuid',true),
    ('hotel_rate_plans','hotel_id','uuid',true),
    ('hotel_rate_plans','code','text',true),
    ('hotel_rate_plans','name_i18n','jsonb',true),
    ('hotel_rate_plans','description_i18n','jsonb',true),
    ('hotel_rate_plans','meal_plan_code','text',false),
    ('hotel_rate_plans','cancellation_policy','jsonb',true),
    ('hotel_rate_plans','booking_mode_override','text',false),
    ('hotel_rate_plans','is_active','boolean',true),
    ('hotel_rate_plans','sort_order','integer',true),
    ('hotel_rate_plans','version','bigint',true),
    ('hotel_rate_plans','created_at','timestamp with time zone',true),
    ('hotel_rate_plans','updated_at','timestamp with time zone',true),
    ('hotel_room_rates','id','uuid',true),
    ('hotel_room_rates','hotel_id','uuid',true),
    ('hotel_room_rates','room_type_id','uuid',true),
    ('hotel_room_rates','rate_plan_id','uuid',true),
    ('hotel_room_rates','base_nightly_rate','numeric(12,2)',true),
    ('hotel_room_rates','currency','character(3)',true),
    ('hotel_room_rates','external_redirect_url','text',false),
    ('hotel_room_rates','is_active','boolean',true),
    ('hotel_room_rates','sort_order','integer',true),
    ('hotel_room_rates','version','bigint',true),
    ('hotel_room_rates','created_at','timestamp with time zone',true),
    ('hotel_room_rates','updated_at','timestamp with time zone',true),
    ('hotel_rate_rules','id','uuid',true),
    ('hotel_rate_rules','room_rate_id','uuid',true),
    ('hotel_rate_rules','valid_from','date',true),
    ('hotel_rate_rules','valid_to','date',true),
    ('hotel_rate_rules','weekdays','smallint[]',true),
    ('hotel_rate_rules','nightly_rate','numeric(12,2)',true),
    ('hotel_rate_rules','minimum_stay','integer',false),
    ('hotel_rate_rules','maximum_stay','integer',false),
    ('hotel_rate_rules','closed_to_arrival','boolean',true),
    ('hotel_rate_rules','closed_to_departure','boolean',true),
    ('hotel_rate_rules','priority','smallint',true),
    ('hotel_rate_rules','is_active','boolean',true),
    ('hotel_rate_rules','version','bigint',true),
    ('hotel_rate_rules','created_at','timestamp with time zone',true),
    ('hotel_rate_rules','updated_at','timestamp with time zone',true),
    ('hotel_daily_inventory','room_type_id','uuid',true),
    ('hotel_daily_inventory','stay_date','date',true),
    ('hotel_daily_inventory','sellable_units','integer',true),
    ('hotel_daily_inventory','closed','boolean',true),
    ('hotel_daily_inventory','source_timestamp','timestamp with time zone',false),
    ('hotel_daily_inventory','provenance','jsonb',true),
    ('hotel_daily_inventory','version','bigint',true),
    ('hotel_daily_inventory','updated_at','timestamp with time zone',true),
    ('hotel_daily_rates','room_rate_id','uuid',true),
    ('hotel_daily_rates','stay_date','date',true),
    ('hotel_daily_rates','nightly_rate','numeric(12,2)',true),
    ('hotel_daily_rates','minimum_stay','integer',false),
    ('hotel_daily_rates','maximum_stay','integer',false),
    ('hotel_daily_rates','closed','boolean',true),
    ('hotel_daily_rates','closed_to_arrival','boolean',true),
    ('hotel_daily_rates','closed_to_departure','boolean',true),
    ('hotel_daily_rates','source_timestamp','timestamp with time zone',false),
    ('hotel_daily_rates','provenance','jsonb',true),
    ('hotel_daily_rates','version','bigint',true),
    ('hotel_daily_rates','updated_at','timestamp with time zone',true)
),
actual_normalized_columns as (
  select
    relation.relname::text as table_name,
    attribute.attname::text as column_name,
    format_type(attribute.atttypid, attribute.atttypmod) as formatted_type,
    attribute.attnotnull as not_null
  from pg_catalog.pg_attribute attribute
  join pg_catalog.pg_class relation on relation.oid = attribute.attrelid
  join pg_catalog.pg_namespace namespace_info on namespace_info.oid = relation.relnamespace
  where namespace_info.nspname = 'public'
    and relation.relname in (
      'hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
      'hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates'
    )
    and attribute.attnum > 0
    and not attribute.attisdropped
),
normalized_column_state as (
  select
    (
      select count(*)
      from expected_normalized_columns expected
      left join actual_normalized_columns actual using (table_name, column_name)
      where actual.column_name is null
         or actual.formatted_type is distinct from expected.formatted_type
         or actual.not_null is distinct from expected.not_null
    )::integer as missing_or_mismatch_count,
    (
      select count(*)
      from actual_normalized_columns actual
      left join expected_normalized_columns expected using (table_name, column_name)
      where expected.column_name is null
    )::integer as unexpected_column_count
),
property_state as (
  select
    count(*)::integer as property_count,
    count(*) filter (where architecture_version = 'legacy')::integer as legacy_property_count,
    count(*) filter (where architecture_version = 'rooms_v2')::integer as rooms_v2_property_count,
    count(*) filter (where booking_mode = 'request_confirmation')::integer as request_confirmation_count,
    count(*) filter (where timezone = 'Europe/Nicosia' and currency = 'EUR')::integer as default_locale_contract_count,
    coalesce(array_agg(id order by id), '{}'::uuid[]) as property_ids,
    md5(coalesce(string_agg(
      (
        to_jsonb(hotel)
        - 'architecture_version'
        - 'timezone'
        - 'currency'
        - 'booking_mode'
        - 'check_in_from'
        - 'check_out_until'
      )::text,
      '|' order by id
    ), '')) as protected_property_fingerprint
  from public.hotels hotel
),
booking_state as (
  select
    count(*)::integer as booking_count,
    count(*) filter (where status = 'confirmed')::integer as confirmed_count,
    count(*) filter (where status = 'cancelled')::integer as cancelled_count,
    coalesce(array_agg(id order by id), '{}'::uuid[]) as booking_ids,
    md5(coalesce(string_agg(to_jsonb(booking)::text, '|' order by id), '')) as booking_fingerprint
  from public.hotel_bookings booking
),
fulfillment_state as (
  select
    count(*)::integer as fulfillment_count,
    count(*) filter (where status = 'accepted')::integer as accepted_count,
    count(*) filter (where status = 'awaiting_payment')::integer as awaiting_payment_count,
    count(*) filter (where status = 'closed')::integer as closed_count,
    coalesce(array_agg(id order by id), '{}'::uuid[]) as fulfillment_ids,
    md5(coalesce(string_agg(to_jsonb(fulfillment)::text, '|' order by id), '')) as fulfillment_fingerprint
  from public.partner_service_fulfillments fulfillment
  where resource_type = 'hotels'
),
relationship_state as (
  select
    (select md5(coalesce(string_agg(to_jsonb(deposit_row)::text, '|' order by deposit_row.id), ''))
     from public.service_deposit_requests deposit_row
     where deposit_row.resource_type = 'hotels') as deposit_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(coupon_row)::text, '|' order by coupon_row.id), ''))
     from public.service_coupon_redemptions coupon_row
     where coupon_row.service_type = 'hotels') as coupon_fingerprint
),
expected_sets as (
  select
    (select array_agg(id order by id) from expected_property_ids) as property_ids,
    (select array_agg(id order by id) from expected_booking_ids) as booking_ids,
    (select array_agg(id order by id) from expected_fulfillment_ids) as fulfillment_ids
),
flag_state as (
  select
    count(*)::integer as settings_row_count,
    count(*) filter (
      where not hotel_rooms_v2_enabled
        and not hotel_external_sync_enabled
        and not hotel_instant_booking_enabled
        and not hotel_stripe_connect_enabled
    )::integer as all_flags_off_count
  from public.site_settings
),
normalized_row_state as (
  select
    (select count(*)::integer from public.hotel_room_types) as room_type_count,
    (select count(*)::integer from public.hotel_units) as unit_count,
    (select count(*)::integer from public.hotel_rate_plans) as rate_plan_count,
    (select count(*)::integer from public.hotel_room_rates) as room_rate_count,
    (select count(*)::integer from public.hotel_rate_rules) as rate_rule_count,
    (select count(*)::integer from public.hotel_daily_inventory) as daily_inventory_count,
    (select count(*)::integer from public.hotel_daily_rates) as daily_rate_count
),
normalized_security_state as (
  select
    count(*) filter (where relation.relrowsecurity)::integer as rls_enabled_count,
    count(*) filter (
      where (
        select count(*)
        from pg_catalog.pg_policies policy_info
        where policy_info.schemaname = 'public'
          and policy_info.tablename = relation.relname
      ) = 1
      and exists (
        select 1
        from pg_catalog.pg_policies policy_info
        where policy_info.schemaname = 'public'
          and policy_info.tablename = relation.relname
          and policy_info.policyname = relation.relname || '_admin_all'
          and policy_info.cmd = 'ALL'
          and policy_info.roles = array['authenticated']::name[]
          and lower(coalesce(policy_info.qual, '')) like '%is_current_user_admin%'
          and lower(coalesce(policy_info.with_check, '')) like '%is_current_user_admin%'
      )
    )::integer as exact_admin_policy_count,
    count(*) filter (
      where not has_table_privilege('anon', relation.oid, 'SELECT')
        and not has_table_privilege('anon', relation.oid, 'INSERT')
        and not has_table_privilege('anon', relation.oid, 'UPDATE')
        and not has_table_privilege('anon', relation.oid, 'DELETE')
        and has_table_privilege('authenticated', relation.oid, 'SELECT')
        and has_table_privilege('authenticated', relation.oid, 'INSERT')
        and has_table_privilege('authenticated', relation.oid, 'UPDATE')
        and has_table_privilege('authenticated', relation.oid, 'DELETE')
    )::integer as fail_closed_grant_count
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace_info on namespace_info.oid = relation.relnamespace
  where namespace_info.nspname = 'public'
    and relation.relname in (
      'hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
      'hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates'
    )
),
normalized_constraint_state as (
  select
    count(*) filter (where constraint_info.oid is not null)::integer as expected_constraint_count
  from (values
    ('hotel_room_types','hotel_room_types_pkey'),
    ('hotel_room_types','hotel_room_types_hotel_id_fkey'),
    ('hotel_room_types','hotel_room_types_code_check'),
    ('hotel_room_types','hotel_room_types_capacity_check'),
    ('hotel_room_types','hotel_room_types_inventory_mode_check'),
    ('hotel_room_types','hotel_room_types_status_check'),
    ('hotel_units','hotel_units_pkey'),
    ('hotel_units','hotel_units_room_type_id_fkey'),
    ('hotel_units','hotel_units_code_check'),
    ('hotel_units','hotel_units_status_check'),
    ('hotel_rate_plans','hotel_rate_plans_pkey'),
    ('hotel_rate_plans','hotel_rate_plans_hotel_id_fkey'),
    ('hotel_rate_plans','hotel_rate_plans_code_check'),
    ('hotel_rate_plans','hotel_rate_plans_booking_mode_override_check'),
    ('hotel_room_rates','hotel_room_rates_pkey'),
    ('hotel_room_rates','hotel_room_rates_room_type_hotel_fkey'),
    ('hotel_room_rates','hotel_room_rates_rate_plan_hotel_fkey'),
    ('hotel_room_rates','hotel_room_rates_room_type_rate_plan_key'),
    ('hotel_rate_rules','hotel_rate_rules_pkey'),
    ('hotel_rate_rules','hotel_rate_rules_room_rate_id_fkey'),
    ('hotel_rate_rules','hotel_rate_rules_date_range_check'),
    ('hotel_rate_rules','hotel_rate_rules_weekdays_check'),
    ('hotel_rate_rules','hotel_rate_rules_stay_check'),
    ('hotel_daily_inventory','hotel_daily_inventory_pkey'),
    ('hotel_daily_inventory','hotel_daily_inventory_room_type_id_fkey'),
    ('hotel_daily_inventory','hotel_daily_inventory_sellable_units_check'),
    ('hotel_daily_rates','hotel_daily_rates_pkey'),
    ('hotel_daily_rates','hotel_daily_rates_room_rate_id_fkey'),
    ('hotel_daily_rates','hotel_daily_rates_nightly_rate_check'),
    ('hotel_daily_rates','hotel_daily_rates_stay_check')
  ) expected(table_name, constraint_name)
  left join pg_catalog.pg_constraint constraint_info
    on constraint_info.conrelid = format('public.%I', expected.table_name)::regclass
   and constraint_info.conname = expected.constraint_name
),
hotel_extension_state as (
  select
    count(*) filter (
      where actual.column_name is null
         or actual.formatted_type is distinct from expected.formatted_type
         or actual.not_null is distinct from expected.not_null
         or actual.default_expression is distinct from expected.default_expression
    )::integer as mismatch_count
  from (values
    ('architecture_version','text',true,'''legacy''::text'),
    ('timezone','text',true,'''Europe/Nicosia''::text'),
    ('currency','character(3)',true,'''EUR''::bpchar'),
    ('booking_mode','text',true,'''request_confirmation''::text'),
    ('check_in_from','time without time zone',false,null),
    ('check_out_until','time without time zone',false,null)
  ) expected(column_name, formatted_type, not_null, default_expression)
  left join (
    select
      attribute.attname::text as column_name,
      format_type(attribute.atttypid, attribute.atttypmod) as formatted_type,
      attribute.attnotnull as not_null,
      pg_get_expr(default_value.adbin, default_value.adrelid) as default_expression
    from pg_catalog.pg_attribute attribute
    left join pg_catalog.pg_attrdef default_value
      on default_value.adrelid = attribute.attrelid
     and default_value.adnum = attribute.attnum
    where attribute.attrelid = 'public.hotels'::regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
  ) actual using (column_name)
),
booking_security_state as (
  select
    coalesce((select relrowsecurity from pg_catalog.pg_class where oid = 'public.hotel_bookings'::regclass), false)
      as rls_enabled,
    exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'hotel_bookings'
        and policyname = 'hotel_bookings_customer_select'
        and cmd = 'SELECT'
        and roles = array['authenticated']::name[]
        and lower(coalesce(qual, '')) like '%auth.uid%'
        and lower(coalesce(qual, '')) not in ('true', '(true)')
    ) as customer_policy_narrow,
    exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'hotel_bookings'
        and policyname = 'hotel_bookings_admin_select'
        and cmd = 'SELECT'
        and roles = array['authenticated']::name[]
        and lower(coalesce(qual, '')) like '%is_current_user_admin%'
    ) as admin_policy_present,
    not exists (
      select 1 from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'hotel_bookings'
        and cmd = 'SELECT'
        and 'authenticated' = any(roles)
        and lower(regexp_replace(coalesce(qual, ''), '[()[:space:]]', '', 'g')) = 'true'
    ) as broad_authenticated_select_removed,
    not has_table_privilege('anon', 'public.hotel_bookings', 'SELECT') as anon_cannot_select,
    has_table_privilege('anon', 'public.hotel_bookings', 'INSERT') as anon_can_submit,
    has_table_privilege('authenticated', 'public.hotel_bookings', 'SELECT') as authenticated_has_policy_gated_select
),
partner_bridge_state as (
  select
    to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)') is not null as partner_rpc_present,
    not coalesce(has_function_privilege(
      'anon',
      to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'),
      'EXECUTE'
    ), false) as partner_rpc_not_anon,
    coalesce(has_function_privilege(
      'authenticated',
      to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'),
      'EXECUTE'
    ), false) as partner_rpc_authenticated,
    not coalesce(has_function_privilege(
      'service_role',
      to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)'),
      'EXECUTE'
    ), false) as partner_rpc_not_service_role,
    exists (
      select 1 from pg_catalog.pg_proc procedure
      where procedure.oid = to_regprocedure('public.partner_get_hotel_booking_operational_context(uuid,uuid[],uuid[],date,date,integer)')
        and procedure.prosecdef
        and coalesce(procedure.proconfig, '{}'::text[]) @> array['search_path=pg_catalog, public']::text[]
    ) as partner_rpc_hardened,
    not coalesce(has_function_privilege(
      'authenticated',
      to_regprocedure('public.upsert_partner_service_fulfillment_from_booking_with_partner(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)'),
      'EXECUTE'
    ), false) as internal_fulfillment_writer_not_browser_callable,
    to_regprocedure('public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)') is not null
      and not coalesce(has_function_privilege(
        'anon', to_regprocedure('public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)'), 'EXECUTE'
      ), false)
      and coalesce(has_function_privilege(
        'authenticated', to_regprocedure('public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)'), 'EXECUTE'
      ), false)
      and not coalesce(has_function_privilege(
        'service_role', to_regprocedure('public.admin_upsert_partner_service_fulfillment_exact(uuid,text,uuid,uuid,date,date,numeric,text,text,text,text,text,text,timestamp with time zone)'), 'EXECUTE'
      ), false) as admin_fulfillment_rpc_auth_only,
    to_regprocedure('public.customer_get_hotel_bookings(integer)') is not null
      and not coalesce(has_function_privilege(
        'anon', to_regprocedure('public.customer_get_hotel_bookings(integer)'), 'EXECUTE'
      ), false)
      and coalesce(has_function_privilege(
        'authenticated', to_regprocedure('public.customer_get_hotel_bookings(integer)'), 'EXECUTE'
      ), false)
      and not coalesce(has_function_privilege(
        'service_role', to_regprocedure('public.customer_get_hotel_bookings(integer)'), 'EXECUTE'
      ), false) as customer_rpc_auth_only,
    to_regprocedure('public.partner_get_referral_attributed_orders_safe(uuid,integer)') is not null
      and not coalesce(has_function_privilege(
        'anon', to_regprocedure('public.partner_get_referral_attributed_orders_safe(uuid,integer)'), 'EXECUTE'
      ), false)
      and coalesce(has_function_privilege(
        'authenticated', to_regprocedure('public.partner_get_referral_attributed_orders_safe(uuid,integer)'), 'EXECUTE'
      ), false)
      and not coalesce(has_function_privilege(
        'service_role', to_regprocedure('public.partner_get_referral_attributed_orders_safe(uuid,integer)'), 'EXECUTE'
      ), false)
      and not coalesce(has_function_privilege(
        'authenticated', to_regprocedure('public.partner_get_referral_attributed_orders(uuid,integer)'), 'EXECUTE'
      ), false) as referral_rpc_redacted_auth_only,
    (
      select count(*)::integer
      from public.partner_service_fulfillments fulfillment
      left join public.hotel_bookings booking on booking.id = fulfillment.booking_id
      where fulfillment.resource_type = 'hotels'
        and (
          booking.id is null
          or fulfillment.resource_id is distinct from booking.hotel_id
        )
    ) as fulfillment_relationship_mismatch_count
),
hotel_function_grant_state as (
  select
    count(*) filter (
      where procedure_info.proname = any(array[
        'hotel_bookings_assign_authenticated_owner',
        'hotel_v2_set_updated_at_and_version',
        'trg_apply_service_coupon_hotel_booking',
        'trg_enqueue_customer_received_hotel_booking',
        'trg_notify_admin_new_hotel_booking',
        'trg_partner_service_fulfillment_from_hotel_booking',
        'trg_service_coupon_redemption_from_hotel_booking',
        'trg_sync_hotel_coupon_to_fulfillment',
        'update_hotel_bookings_updated_at',
        'update_hotel_categories_updated_at',
        'update_hotel_cities_updated_at',
        'update_hotels_updated_at',
        'validate_hotels_photos_len'
      ]::text[])
    )::integer as trigger_helper_count,
    count(*) filter (
      where procedure_info.proname = any(array[
        'hotel_bookings_assign_authenticated_owner',
        'hotel_v2_set_updated_at_and_version',
        'trg_apply_service_coupon_hotel_booking',
        'trg_enqueue_customer_received_hotel_booking',
        'trg_notify_admin_new_hotel_booking',
        'trg_partner_service_fulfillment_from_hotel_booking',
        'trg_service_coupon_redemption_from_hotel_booking',
        'trg_sync_hotel_coupon_to_fulfillment',
        'update_hotel_bookings_updated_at',
        'update_hotel_categories_updated_at',
        'update_hotel_cities_updated_at',
        'update_hotels_updated_at',
        'validate_hotels_photos_len'
      ]::text[])
      and (
        has_function_privilege('anon', procedure_info.oid, 'EXECUTE')
        or has_function_privilege('authenticated', procedure_info.oid, 'EXECUTE')
        or not has_function_privilege('service_role', procedure_info.oid, 'EXECUTE')
        or not (coalesce(procedure_info.proconfig, '{}'::text[]) @> array['search_path=pg_catalog, public']::text[])
      )
    )::integer as trigger_helper_mismatch_count,
    count(*) filter (
      where procedure_info.proname = 'admin_apply_hotel_booking_manual_adjustment'
    )::integer as admin_adjustment_function_count,
    count(*) filter (
      where procedure_info.proname = 'admin_apply_hotel_booking_manual_adjustment'
        and (
          has_function_privilege('anon', procedure_info.oid, 'EXECUTE')
          or not has_function_privilege('authenticated', procedure_info.oid, 'EXECUTE')
          or not has_function_privilege('service_role', procedure_info.oid, 'EXECUTE')
          or not (coalesce(procedure_info.proconfig, '{}'::text[]) @> array['search_path=pg_catalog, public']::text[])
        )
    )::integer as admin_adjustment_mismatch_count,
    count(*) filter (
      where procedure_info.proname = any(array[
        'upsert_partner_service_fulfillment_from_booking',
        'upsert_partner_service_fulfillment_from_booking_with_partner',
        'upsert_partner_service_fulfillments_for_resource_partners'
      ]::text[])
    )::integer as internal_fulfillment_function_count,
    count(*) filter (
      where procedure_info.proname = any(array[
        'upsert_partner_service_fulfillment_from_booking',
        'upsert_partner_service_fulfillment_from_booking_with_partner',
        'upsert_partner_service_fulfillments_for_resource_partners'
      ]::text[])
        and (
          has_function_privilege('anon', procedure_info.oid, 'EXECUTE')
          or has_function_privilege('authenticated', procedure_info.oid, 'EXECUTE')
          or not has_function_privilege('service_role', procedure_info.oid, 'EXECUTE')
          or not (coalesce(procedure_info.proconfig, '{}'::text[]) @> array['search_path=pg_catalog, public']::text[])
        )
    )::integer as internal_fulfillment_mismatch_count
  from pg_catalog.pg_proc procedure_info
  join pg_catalog.pg_namespace namespace_info
    on namespace_info.oid = procedure_info.pronamespace
  where namespace_info.nspname = 'public'
),
live_reconciliation_state as (
  select
    (select count(*) from public.hotel_cities)::integer as city_count,
    (select count(*) from public.hotel_amenities)::integer as amenity_count,
    (select count(*) from public.hotel_categories)::integer as category_count,
    (select md5(coalesce(string_agg(to_jsonb(city)::text, '|' order by city.id), '')) from public.hotel_cities city)
      as city_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(amenity)::text, '|' order by amenity.id), '')) from public.hotel_amenities amenity)
      as amenity_fingerprint,
    coalesce((select relrowsecurity from pg_catalog.pg_class where oid = 'public.hotel_cities'::regclass), false)
      and coalesce((select relrowsecurity from pg_catalog.pg_class where oid = 'public.hotel_amenities'::regclass), false)
      as live_tables_rls_enabled,
    (
      select count(*) = 4
        and count(*) filter (
          where cmd = 'SELECT'
            and policyname in ('hotel_cities_select_public', 'hotel_amenities_select_public')
            and permissive = 'PERMISSIVE'
            and roles = array['public']::name[]
            and regexp_replace(lower(coalesce(qual, '')), '[()[:space:]"]', '', 'g') = 'is_active=true'
            and with_check is null
        ) = 2
        and count(*) filter (
          where cmd = 'ALL'
            and policyname in ('hotel_cities_all_admin', 'hotel_amenities_all_admin')
            and permissive = 'PERMISSIVE'
            and roles = array['public']::name[]
            and regexp_replace(lower(coalesce(qual, '')), '[()[:space:]"]', '', 'g') =
                'existsselect1fromprofileswhereprofiles.id=auth.uidandprofiles.is_admin=true'
            and regexp_replace(lower(coalesce(with_check, '')), '[()[:space:]"]', '', 'g') =
                'existsselect1fromprofileswhereprofiles.id=auth.uidandprofiles.is_admin=true'
        ) = 2
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename in ('hotel_cities', 'hotel_amenities')
    ) as live_policy_contract_match,
    (
      select count(*) filter (
        where (index_relation.relname, pg_get_indexdef(index_relation.oid)) in (
          ('hotel_cities_pkey', 'CREATE UNIQUE INDEX hotel_cities_pkey ON public.hotel_cities USING btree (id)'),
          ('hotel_cities_name_key', 'CREATE UNIQUE INDEX hotel_cities_name_key ON public.hotel_cities USING btree (name)'),
          ('hotel_cities_display_order_idx', 'CREATE INDEX hotel_cities_display_order_idx ON public.hotel_cities USING btree (display_order)'),
          ('hotel_cities_is_active_idx', 'CREATE INDEX hotel_cities_is_active_idx ON public.hotel_cities USING btree (is_active)'),
          ('hotel_amenities_pkey', 'CREATE UNIQUE INDEX hotel_amenities_pkey ON public.hotel_amenities USING btree (id)'),
          ('hotel_amenities_code_key', 'CREATE UNIQUE INDEX hotel_amenities_code_key ON public.hotel_amenities USING btree (code)'),
          ('hotel_amenities_category_idx', 'CREATE INDEX hotel_amenities_category_idx ON public.hotel_amenities USING btree (category)'),
          ('hotel_amenities_display_order_idx', 'CREATE INDEX hotel_amenities_display_order_idx ON public.hotel_amenities USING btree (display_order)'),
          ('hotel_amenities_is_active_idx', 'CREATE INDEX hotel_amenities_is_active_idx ON public.hotel_amenities USING btree (is_active)')
        )
      ) = 9
      and count(*) = 9
      from pg_catalog.pg_index index_info
      join pg_catalog.pg_class index_relation on index_relation.oid = index_info.indexrelid
      where index_info.indrelid in ('public.hotel_cities'::regclass, 'public.hotel_amenities'::regclass)
    ) as live_index_contract_match,
    (
      select bool_and(
        has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
        and not has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
        and not has_table_privilege('anon', format('public.%I', table_name), 'UPDATE')
        and not has_table_privilege('anon', format('public.%I', table_name), 'DELETE')
        and not has_table_privilege('anon', format('public.%I', table_name), 'TRUNCATE')
        and not has_table_privilege('anon', format('public.%I', table_name), 'REFERENCES')
        and not has_table_privilege('anon', format('public.%I', table_name), 'TRIGGER')
        and has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT')
        and has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
        and has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
        and has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE')
        and not has_table_privilege('authenticated', format('public.%I', table_name), 'TRUNCATE')
        and not has_table_privilege('authenticated', format('public.%I', table_name), 'REFERENCES')
        and not has_table_privilege('authenticated', format('public.%I', table_name), 'TRIGGER')
      )
      from unnest(array['hotel_cities', 'hotel_amenities']::text[]) table_names(table_name)
    ) as live_grant_contract_match,
    exists (
      select 1
      from pg_catalog.pg_trigger trigger_info
      where trigger_info.tgrelid = 'public.hotel_cities'::regclass
        and trigger_info.tgname = 'trg_update_hotel_cities_updated_at'
        and not trigger_info.tgisinternal
        and trigger_info.tgfoid = 'public.update_hotel_cities_updated_at()'::regprocedure
        and pg_get_triggerdef(trigger_info.oid, true) =
          'CREATE TRIGGER trg_update_hotel_cities_updated_at BEFORE UPDATE ON hotel_cities FOR EACH ROW EXECUTE FUNCTION update_hotel_cities_updated_at()'
    ) as live_trigger_contract_match,
    obj_description('public.hotel_cities'::regclass, 'pg_class') = 'Dynamic cities/locations for hotels management'
      and col_description('public.hotel_cities'::regclass, (
        select attnum from pg_attribute where attrelid = 'public.hotel_cities'::regclass and attname = 'name'
      )) = 'Primary city name (used as value)'
      and col_description('public.hotel_cities'::regclass, (
        select attnum from pg_attribute where attrelid = 'public.hotel_cities'::regclass and attname = 'display_order'
      )) = 'Order in dropdowns (lower = first)'
      and col_description('public.hotel_amenities'::regclass, (
        select attnum from pg_attribute where attrelid = 'public.hotel_amenities'::regclass and attname = 'name_he'
      )) = 'Internal Hebrew hotel amenity label. Hidden until controlled Hebrew public rollout.'
      as live_comments_match,
    obj_description('public.hotel_categories'::regclass, 'pg_class') =
      'Legacy/deprecated Hotel categorization retained for compatibility. Hotels 2.0 H1A does not depend on this table.'
      as category_documented_legacy
),
deferred_state as (
  select
    to_regclass('public.hotel_calendar_overrides') is null as calendar_overrides_deferred,
    to_regclass('public.hotel_activity_log') is null as activity_log_deferred,
    to_regclass('public.hotel_sync_sources') is null as sync_sources_deferred,
    not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'hotel_daily_inventory'
        and column_name in ('sync_source_id', 'sync_run_id')
    ) as future_sync_fks_deferred
),
legacy_property_oracle as (
  select
    2 - count(*) filter (
      where (
        hotel.id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        and to_jsonb(hotel)->>'slug' = '7-ukow'
        and to_jsonb(hotel)->>'pricing_model' = 'tiered_by_nights'
        and md5((to_jsonb(hotel)->'pricing_tiers')::text) = '7208ab4ecc0e47abd64d87ca1ac53a03'
        and (to_jsonb(hotel)->>'max_persons')::integer = 8
      ) or (
        hotel.id = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid
        and to_jsonb(hotel)->>'slug' = 'rgb-cabins-larnaka-centrum'
        and to_jsonb(hotel)->>'pricing_model' = 'flat_per_night'
        and md5((to_jsonb(hotel)->'pricing_tiers')::text) = 'e272ec40b78069a1e2e49ac6b0956f11'
        and (to_jsonb(hotel)->>'max_persons')::integer = 2
      )
    )::integer as price_input_mismatch_count,
    2 - count(*) filter (
      where (
        hotel.id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
        and to_jsonb(hotel)->>'slug' = '7-ukow'
        and to_jsonb(hotel)->'title'->>'en' = '7 Arches'
        and to_jsonb(hotel)->>'city' = 'Lefkara'
        and (to_jsonb(hotel)->>'is_published')::boolean is true
        and to_jsonb(hotel)->>'status' = 'draft'
        and to_jsonb(hotel)->>'submission_status' = 'draft'
        and jsonb_array_length(to_jsonb(hotel)->'photos') = 9
        and md5((to_jsonb(hotel)->'photos')::text) = 'f56efe166beedfa231540592a1c73cc6'
        and md5((to_jsonb(hotel)->'room_types')::text) = 'd751713988987e9331980363e24189ce'
      ) or (
        hotel.id = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid
        and to_jsonb(hotel)->>'slug' = 'rgb-cabins-larnaka-centrum'
        and to_jsonb(hotel)->'title'->>'en' = 'RGB Cabins – Larnaca City Centre'
        and to_jsonb(hotel)->>'city' = 'Larnaca'
        and (to_jsonb(hotel)->>'is_published')::boolean is false
        and to_jsonb(hotel)->>'status' = 'draft'
        and to_jsonb(hotel)->>'submission_status' = 'draft'
        and jsonb_array_length(to_jsonb(hotel)->'photos') = 21
        and md5((to_jsonb(hotel)->'photos')::text) = '9f1f85e35e0d68700fe0dca546171cf6'
        and md5((to_jsonb(hotel)->'room_types')::text) = 'd751713988987e9331980363e24189ce'
      )
    )::integer as public_input_mismatch_count
  from public.hotels hotel
  where hotel.id in (
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid,
    'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid
  )
),
oracle as (
  select
    greatest(
      legacy.price_input_mismatch_count,
      case when property.protected_property_fingerprint = 'b3e3a9c5bda72a83e49d3095d175ab9c' then 0 else 1 end
    ) as hotel_legacy_price_mismatch,
    greatest(
      legacy.public_input_mismatch_count,
      case when property.protected_property_fingerprint = 'b3e3a9c5bda72a83e49d3095d175ab9c' then 0 else 1 end
    ) as hotel_legacy_public_mismatch,
    case when booking.booking_fingerprint = 'fb5a4c508b0df32afbffe5b1594c7a50'
           and fulfillment.fulfillment_fingerprint = '1e01541853d87d26adccb8172074934b'
           and relationships.deposit_fingerprint = '42b5e1dc9726890e90014c3e89c2329d'
           and relationships.coupon_fingerprint = 'd41d8cd98f00b204e9800998ecf8427e'
         then 0 else 1 end as hotel_booking_payload_unexplained_difference
  from property_state property
  cross join booking_state booking
  cross join fulfillment_state fulfillment
  cross join relationship_state relationships
  cross join legacy_property_oracle legacy
)
select
  property.property_count,
  property.legacy_property_count,
  property.rooms_v2_property_count,
  property.request_confirmation_count,
  property.property_ids,
  booking.booking_count,
  booking.confirmed_count,
  booking.cancelled_count,
  booking.booking_ids,
  fulfillment.fulfillment_count,
  fulfillment.accepted_count,
  fulfillment.awaiting_payment_count,
  fulfillment.closed_count,
  fulfillment.fulfillment_ids,
  normalized_rows.room_type_count,
  normalized_rows.unit_count,
  normalized_rows.rate_plan_count,
  normalized_rows.room_rate_count,
  normalized_rows.rate_rule_count,
  normalized_rows.daily_inventory_count,
  normalized_rows.daily_rate_count,
  flags.all_flags_off_count,
  live.city_count,
  live.amenity_count,
  live.category_count,
  booking_security.broad_authenticated_select_removed,
  booking_security.customer_policy_narrow,
  booking_security.admin_policy_present,
  booking_security.anon_cannot_select,
  partner_bridge.partner_rpc_present,
  partner_bridge.partner_rpc_not_anon,
  partner_bridge.partner_rpc_authenticated,
  partner_bridge.partner_rpc_not_service_role,
  partner_bridge.customer_rpc_auth_only,
  partner_bridge.referral_rpc_redacted_auth_only,
  partner_bridge.fulfillment_relationship_mismatch_count,
  partner_bridge.internal_fulfillment_writer_not_browser_callable,
  partner_bridge.admin_fulfillment_rpc_auth_only,
  function_grants.trigger_helper_count,
  function_grants.trigger_helper_mismatch_count,
  function_grants.admin_adjustment_function_count,
  function_grants.admin_adjustment_mismatch_count,
  function_grants.internal_fulfillment_function_count,
  function_grants.internal_fulfillment_mismatch_count,
  property.protected_property_fingerprint,
  booking.booking_fingerprint,
  fulfillment.fulfillment_fingerprint,
  relationships.deposit_fingerprint,
  relationships.coupon_fingerprint,
  oracle.hotel_legacy_price_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  oracle.hotel_legacy_public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  oracle.hotel_booking_payload_unexplained_difference as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  (
    property.property_count = 2
    and property.legacy_property_count = 2
    and property.rooms_v2_property_count = 0
    and property.request_confirmation_count = 2
    and property.default_locale_contract_count = 2
    and property.property_ids = expected.property_ids
    and property.protected_property_fingerprint = 'b3e3a9c5bda72a83e49d3095d175ab9c'
    and booking.booking_count = 3
    and booking.confirmed_count = 2
    and booking.cancelled_count = 1
    and booking.booking_ids = expected.booking_ids
    and booking.booking_fingerprint = 'fb5a4c508b0df32afbffe5b1594c7a50'
    and fulfillment.fulfillment_count = 5
    and fulfillment.accepted_count = 2
    and fulfillment.awaiting_payment_count = 1
    and fulfillment.closed_count = 2
    and fulfillment.fulfillment_ids = expected.fulfillment_ids
    and fulfillment.fulfillment_fingerprint = '1e01541853d87d26adccb8172074934b'
    and relationships.deposit_fingerprint = '42b5e1dc9726890e90014c3e89c2329d'
    and relationships.coupon_fingerprint = 'd41d8cd98f00b204e9800998ecf8427e'
    and flags.settings_row_count = 1
    and flags.all_flags_off_count = 1
    and normalized_columns.missing_or_mismatch_count = 0
    and normalized_columns.unexpected_column_count = 0
    and normalized_constraints.expected_constraint_count = 30
    and normalized_security.rls_enabled_count = 7
    and normalized_security.exact_admin_policy_count = 7
    and normalized_security.fail_closed_grant_count = 7
    and normalized_rows.room_type_count = 0
    and normalized_rows.unit_count = 0
    and normalized_rows.rate_plan_count = 0
    and normalized_rows.room_rate_count = 0
    and normalized_rows.rate_rule_count = 0
    and normalized_rows.daily_inventory_count = 0
    and normalized_rows.daily_rate_count = 0
    and hotel_extensions.mismatch_count = 0
    and booking_security.rls_enabled
    and booking_security.customer_policy_narrow
    and booking_security.admin_policy_present
    and booking_security.broad_authenticated_select_removed
    and booking_security.anon_cannot_select
    and booking_security.anon_can_submit
    and booking_security.authenticated_has_policy_gated_select
    and partner_bridge.partner_rpc_present
    and partner_bridge.partner_rpc_not_anon
    and partner_bridge.partner_rpc_authenticated
    and partner_bridge.partner_rpc_not_service_role
    and partner_bridge.partner_rpc_hardened
    and partner_bridge.customer_rpc_auth_only
    and partner_bridge.referral_rpc_redacted_auth_only
    and partner_bridge.fulfillment_relationship_mismatch_count = 0
    and partner_bridge.internal_fulfillment_writer_not_browser_callable
    and partner_bridge.admin_fulfillment_rpc_auth_only
    and function_grants.trigger_helper_count >= 2
    and function_grants.trigger_helper_mismatch_count = 0
    and function_grants.admin_adjustment_function_count >= 1
    and function_grants.admin_adjustment_mismatch_count = 0
    and function_grants.internal_fulfillment_function_count >= 1
    and function_grants.internal_fulfillment_mismatch_count = 0
    and live.city_count = 9
    and live.city_fingerprint = 'b7ae5a40bbafee23e7f05173f8bdaa33'
    and live.amenity_count = 48
    and live.amenity_fingerprint = '2286f8bd978e9b321f8191a6a3dbf8eb'
    and live.category_count = 0
    and live.live_tables_rls_enabled
    and live.live_policy_contract_match
    and live.live_index_contract_match
    and live.live_grant_contract_match
    and live.live_trigger_contract_match
    and live.live_comments_match
    and live.category_documented_legacy
    and deferred.calendar_overrides_deferred
    and deferred.activity_log_deferred
    and deferred.sync_sources_deferred
    and deferred.future_sync_fks_deferred
    and oracle.hotel_legacy_price_mismatch = 0
    and oracle.hotel_legacy_public_mismatch = 0
    and oracle.hotel_booking_payload_unexplained_difference = 0
  ) as hotels_v2_h1a_foundation_safe
from property_state property
cross join booking_state booking
cross join fulfillment_state fulfillment
cross join relationship_state relationships
cross join expected_sets expected
cross join flag_state flags
cross join normalized_row_state normalized_rows
cross join normalized_column_state normalized_columns
cross join normalized_security_state normalized_security
cross join normalized_constraint_state normalized_constraints
cross join hotel_extension_state hotel_extensions
cross join booking_security_state booking_security
cross join partner_bridge_state partner_bridge
cross join hotel_function_grant_state function_grants
cross join live_reconciliation_state live
cross join deferred_state deferred
cross join oracle;
