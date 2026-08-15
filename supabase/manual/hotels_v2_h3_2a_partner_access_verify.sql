-- Hotels V2 H3.2A Partner access foundation verification (READ ONLY).
-- Run immediately after migration 20260811320000 and before any Admin
-- permission save. The three foundation relations must still be empty.

select set_config('hotels_v2.h3_2a_expected_booking_count',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_booking_count', true), ''), '3'), false);
select set_config('hotels_v2.h3_2a_expected_booking_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_booking_fingerprint', true), ''),
    'fb5a4c508b0df32afbffe5b1594c7a50'), false);
select set_config('hotels_v2.h3_2a_expected_fulfillment_count',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_fulfillment_count', true), ''), '5'), false);
select set_config('hotels_v2.h3_2a_expected_fulfillment_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_fulfillment_fingerprint', true), ''),
    '1e01541853d87d26adccb8172074934b'), false);
select set_config('hotels_v2.h3_2a_expected_deposit_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_deposit_fingerprint', true), ''),
    '42b5e1dc9726890e90014c3e89c2329d'), false);
select set_config('hotels_v2.h3_2a_expected_coupon_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_coupon_fingerprint', true), ''),
    'd41d8cd98f00b204e9800998ecf8427e'), false);
select set_config('hotels_v2.h3_2a_expected_rgb_pricing_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.h3_2a_expected_rgb_pricing_fingerprint', true), ''),
    'e272ec40b78069a1e2e49ac6b0956f11'), false);

do $verify$
declare
  v_table text;
  v_signature text;
  v_columns text[];
  v_pricing_snapshot jsonb;
  v_policy_names text[];
begin
  if to_regclass('public.hotel_partner_hotel_permissions') is null
     or to_regclass('public.hotel_partner_action_receipts') is null
     or to_regclass('public.hotel_partner_event_outbox') is null
     or to_regprocedure('public.hotel_v2_admin_get_partner_hotel_permissions(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)') is null
     or to_regprocedure('public.hotel_v2_partner_list_assigned_properties(uuid)') is null then
    raise exception 'HOTELS_V2_H3_2A_VERIFY_FAIL: foundation object missing';
  end if;

  if to_regclass('public.hotel_partner_property_drafts') is not null
     or to_regclass('public.hotel_media_assets') is not null
     or to_regclass('public.hotel_booking_change_requests') is not null
     or to_regclass('public.partner_payment_accounts') is not null
     or to_regclass('public.partner_payment_account_events') is not null then
    raise exception 'HOTELS_V2_H3_2A_VERIFY_FAIL: deferred H3.2B/C/D boundary violated';
  end if;

  if (select count(*) from public.hotel_partner_hotel_permissions) <> 0
     or (select count(*) from public.hotel_partner_action_receipts) <> 0
     or (select count(*) from public.hotel_partner_event_outbox) <> 0 then
    raise exception 'HOTELS_V2_H3_2A_VERIFY_FAIL: migration seeded operational rows';
  end if;

  select array_agg(column_name order by ordinal_position)
  into v_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'hotel_partner_hotel_permissions';
  if v_columns is distinct from array[
    'assignment_id','partner_id','hotel_id','resource_type',
    'edit_property_content','edit_property_photos','edit_room_content','edit_room_photos',
    'create_rooms','edit_room_structure','manage_prices','manage_availability',
    'process_bookings','request_booking_changes','view_payment_status','initiate_stripe_onboarding',
    'has_mutation_capability','version','created_by','updated_by','created_at','updated_at'
  ]::text[] then
    raise exception 'HOTELS_V2_H3_2A_VERIFY_FAIL: capability schema mismatch';
  end if;

  if not exists (
       select 1 from pg_catalog.pg_indexes
       where schemaname = 'public'
         and tablename = 'hotel_partner_hotel_permissions'
         and indexname = 'hotel_partner_hotel_permissions_one_mutator_uidx'
         and indexdef like '%UNIQUE INDEX%WHERE has_mutation_capability'
     )
     or not exists (
       select 1 from pg_catalog.pg_constraint
       where conrelid = 'public.hotel_partner_action_receipts'::regclass
         and conname = 'hotel_partner_action_receipts_partner_correlation_key'
         and contype = 'u'
     ) then
    raise exception 'HOTELS_V2_H3_2A_VERIFY_FAIL: concurrency uniqueness missing';
  end if;

  foreach v_table in array array[
    'hotel_partner_hotel_permissions',
    'hotel_partner_action_receipts',
    'hotel_partner_event_outbox'
  ] loop
    if not exists (
         select 1 from pg_catalog.pg_class relation
         join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
         where namespace.nspname = 'public'
           and relation.relname = v_table
           and relation.relrowsecurity
           and pg_get_userbyid(relation.relowner) = 'postgres'
       )
       or exists (
         select 1 from pg_catalog.pg_policy
         where polrelid = format('public.%I', v_table)::regclass
       )
       or has_table_privilege(0::oid, format('public.%I', v_table)::regclass, 'SELECT')
       or has_table_privilege('anon', format('public.%I', v_table)::regclass, 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', v_table)::regclass, 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', v_table)::regclass, 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table)::regclass, 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table)::regclass, 'DELETE')
       or has_table_privilege('service_role', format('public.%I', v_table)::regclass, 'SELECT')
       or has_table_privilege('service_role', format('public.%I', v_table)::regclass, 'INSERT')
       or has_table_privilege('service_role', format('public.%I', v_table)::regclass, 'UPDATE')
       or has_table_privilege('service_role', format('public.%I', v_table)::regclass, 'DELETE') then
      raise exception 'HOTELS_V2_H3_2A_VERIFY_FAIL: raw table ACL mismatch: %', v_table;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.hotel_v2_admin_get_partner_hotel_permissions(uuid)',
    'public.hotel_v2_admin_apply_partner_hotel_permissions(jsonb,uuid,uuid)',
    'public.hotel_v2_partner_list_assigned_properties(uuid)'
  ] loop
    if not exists (
         select 1 from pg_catalog.pg_proc procedure
         where procedure.oid = v_signature::regprocedure
           and procedure.prokind = 'f'
           and procedure.prosecdef
           and pg_get_userbyid(procedure.proowner) = 'postgres'
           and procedure.proconfig @> array['search_path=pg_catalog, public, auth']
       )
       or has_function_privilege(0::oid, v_signature::regprocedure, 'EXECUTE')
       or has_function_privilege('anon', v_signature::regprocedure, 'EXECUTE')
       or not has_function_privilege('authenticated', v_signature::regprocedure, 'EXECUTE')
       or has_function_privilege('service_role', v_signature::regprocedure, 'EXECUTE') then
      raise exception 'HOTELS_V2_H3_2A_VERIFY_FAIL: RPC security mismatch: %', v_signature;
    end if;
  end loop;

  if (select count(*) from public.site_settings) <> 1
     or not exists (
       select 1 from public.site_settings where id = 1
         and not hotel_rooms_v2_enabled
         and not hotel_external_sync_enabled
         and not hotel_instant_booking_enabled
         and not hotel_stripe_connect_enabled
     ) then
    raise exception 'HOTELS_V2_H3_2A_VERIFY_FAIL: Hotels V2 flags changed';
  end if;

  if not exists (
       select 1 from public.hotels
       where id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
         and architecture_version = 'legacy'
         and md5(pricing_tiers::text) = '7208ab4ecc0e47abd64d87ca1ac53a03'
     )
     or not exists (
       select 1 from public.hotels
       where id = 'f9fbaa61-fdce-4418-8579-ddb2b0a75fb1'::uuid
         and architecture_version = 'legacy'
         and md5(pricing_tiers::text)
           = current_setting('hotels_v2.h3_2a_expected_rgb_pricing_fingerprint')
     ) then
    raise exception 'HOTELS_V2_H3_2A_VERIFY_FAIL: legacy Hotel state changed';
  end if;

  if not exists (
       select 1 from public.hotel_pricing_promotion_reviews
       where hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
         and contract_version = 'seven_kamares_legacy_to_h3_pricing_v1'
         and source_fingerprint = '7208ab4ecc0e47abd64d87ca1ac53a03'
         and parity_case_count = 70 and parity_mismatch_count = 0
     )
     or (select count(*) from public.hotel_room_types
         where hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid) <> 2
     or (select count(*) from public.hotel_rate_plans
         where hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid) <> 1
     or (select count(*) from public.hotel_room_rates
         where hotel_id = '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid) <> 2
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers
         where schedule_id = 'b0a3104f-7b31-5265-a59f-c2d166f11a23'::uuid) <> 27
     or (select count(*) from public.hotel_pricing_schedule_occupancy_tiers
         where schedule_id = '443065c0-984a-5de3-a22a-d03042c41107'::uuid) <> 63
     or (select count(*) from public.hotel_room_allocation_rule_items
         where pricing_guest_count is not null) <> 8 then
    raise exception 'HOTELS_V2_H3_2A_VERIFY_FAIL: H3.1/H3.1P graph changed';
  end if;

  v_pricing_snapshot := public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  );
  if not coalesce((v_pricing_snapshot->>'supported')::boolean, false)
     or v_pricing_snapshot#>>'{promotion,status}' <> 'reviewed'
     or v_pricing_snapshot#>>'{source,pricing_fingerprint}' <> '7208ab4ecc0e47abd64d87ca1ac53a03'
     or (v_pricing_snapshot#>>'{source,rule_count}')::integer <> 63
     or (v_pricing_snapshot#>>'{target,room_schedule,tier_count}')::integer <> 27
     or (v_pricing_snapshot#>>'{source,property_party_preview,tier_count}')::integer <> 63
     or (v_pricing_snapshot#>>'{parity,total_case_count}')::integer <> 70
     or (v_pricing_snapshot#>>'{parity,total_mismatch_count}')::integer <> 0
     or (v_pricing_snapshot#>>'{target,rate_plan,is_active}')::boolean
     or exists (
       select 1 from jsonb_array_elements(v_pricing_snapshot#>'{target,room_rates}') room_rate(value)
       where (room_rate.value->>'is_active')::boolean
          or (room_rate.value->>'currency') <> 'EUR'
     ) then
    raise exception 'HOTELS_V2_H3_2A_VERIFY_FAIL: exact H3.1P pricing snapshot drift: %',
      v_pricing_snapshot->'blockers';
  end if;

  select array_agg(policyname order by policyname)
  into v_policy_names
  from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'hotels';
  if v_policy_names is distinct from array[
       'Anyone can view published hotels',
       'hotels_admin_all',
       'hotels_authenticated_select',
       'hotels_partner_delete',
       'hotels_partner_insert',
       'hotels_partner_update'
     ]::text[]
     or not exists (
       select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'hotels'
         and policyname = 'Anyone can view published hotels'
         and cmd = 'SELECT' and qual like '%is_published = true%'
     )
     or not exists (
       select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'hotels'
         and policyname = 'hotels_authenticated_select'
         and cmd = 'SELECT' and roles = array['authenticated']::name[]
         and qual like '%is_current_user_admin()%'
         and qual like '%is_partner_user(owner_partner_id)%'
     )
     or not exists (
       select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'hotels'
         and policyname = 'hotels_admin_all' and cmd = 'ALL'
         and roles = array['authenticated']::name[]
         and qual = 'is_current_user_admin()' and with_check = 'is_current_user_admin()'
     )
     or (select count(*) from pg_catalog.pg_policies
         where schemaname = 'public' and tablename = 'hotels'
           and policyname in ('hotels_partner_insert','hotels_partner_update','hotels_partner_delete')
           and coalesce(qual, with_check) like '%is_partner_user(owner_partner_id)%'
           and coalesce(qual, with_check) like '%is_published = false%') <> 3 then
    raise exception 'HOTELS_V2_H3_2A_VERIFY_FAIL: legacy raw Hotel RLS definitions changed';
  end if;

  if (select count(*) from public.hotel_bookings)
       <> current_setting('hotels_v2.h3_2a_expected_booking_count')::integer
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
         from public.hotel_bookings row_value)
       <> current_setting('hotels_v2.h3_2a_expected_booking_fingerprint')
     or (select count(*) from public.partner_service_fulfillments where resource_type = 'hotels')
       <> current_setting('hotels_v2.h3_2a_expected_fulfillment_count')::integer
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
         from public.partner_service_fulfillments row_value where resource_type = 'hotels')
       <> current_setting('hotels_v2.h3_2a_expected_fulfillment_fingerprint')
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
         from public.service_deposit_requests row_value where resource_type = 'hotels')
       <> current_setting('hotels_v2.h3_2a_expected_deposit_fingerprint')
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|' order by row_value.id), ''))
         from public.service_coupon_redemptions row_value where service_type = 'hotels')
       <> current_setting('hotels_v2.h3_2a_expected_coupon_fingerprint') then
    raise exception 'HOTELS_V2_H3_2A_VERIFY_FAIL: protected booking/commercial history changed';
  end if;
end
$verify$;

select set_config('hotels_v2.h3_2a_expected_booking_count', '', false);
select set_config('hotels_v2.h3_2a_expected_booking_fingerprint', '', false);
select set_config('hotels_v2.h3_2a_expected_fulfillment_count', '', false);
select set_config('hotels_v2.h3_2a_expected_fulfillment_fingerprint', '', false);
select set_config('hotels_v2.h3_2a_expected_deposit_fingerprint', '', false);
select set_config('hotels_v2.h3_2a_expected_coupon_fingerprint', '', false);
select set_config('hotels_v2.h3_2a_expected_rgb_pricing_fingerprint', '', false);

with
policies as (
  select md5(coalesce(string_agg(jsonb_build_object(
    'policyname', policyname,
    'permissive', permissive,
    'roles', roles,
    'cmd', cmd,
    'qual', qual,
    'with_check', with_check
  )::text, '|' order by policyname), '')) fingerprint
  from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'hotels'
),
protected_relations as (
  select jsonb_object_agg(relation.relname, md5(pg_catalog.query_to_xml(format(
    'select to_jsonb(row_value)::text as row_value from public.%I row_value order by to_jsonb(row_value)::text',
    relation.relname
  ), true, true, '')::text) order by relation.relname) fingerprints
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r','p')
    and relation.relname in (
      'service_deposit_requests','service_deposit_rules','service_deposit_overrides',
      'service_coupons','service_coupon_redemptions',
      'hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
      'hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates',
      'hotel_room_rate_occupancy_tiers','hotel_calendar_overrides',
      'hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
      'hotel_room_allocation_rules','hotel_room_allocation_rule_items',
      'hotel_payment_policies','hotel_payment_policy_terms','hotel_commission_policies',
      'hotel_calendar_source_configs','hotel_pricing_promotion_reviews',
      'referrals','affiliate_commission_events','affiliate_payouts','affiliate_adjustments',
      'affiliate_program_settings','affiliate_referrer_overrides',
      'affiliate_cashout_requests','profile_referral_code_aliases'
    )
)
select
  policies.fingerprint as legacy_hotels_rls_fingerprint,
  protected_relations.fingerprints as protected_relation_fingerprints,
  0 as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PRICE_MISMATCH",
  0 as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  0 as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  true as hotels_v2_h3_2a_partner_access_foundation_safe
from policies cross join protected_relations;
