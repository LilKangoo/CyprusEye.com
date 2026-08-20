-- Hotels V2 ADMIN-B content, Room Type and assignment foundation verification.
-- READ ONLY. Supabase SQL Editor compatible (no psql meta-commands).
-- Run immediately after migration 20260811340000 and before any ADMIN-B save.
-- Compare protected_relation_fingerprints byte-for-byte with preflight output.

select set_config('hotels_v2.admin_b_expected_property_gallery_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_property_gallery_fingerprint',true),''),
    'f56efe166beedfa231540592a1c73cc6'),false);
select set_config('hotels_v2.admin_b_expected_owner_partner_id',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_owner_partner_id',true),''),
    '0a321bfe-da6b-43f6-8e0b-7c68546a8b18'),false);
select set_config('hotels_v2.admin_b_expected_upper_version',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_upper_version',true),''),'21'),false);
select set_config('hotels_v2.admin_b_expected_upper_gallery_count',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_upper_gallery_count',true),''),'6'),false);
select set_config('hotels_v2.admin_b_expected_upper_gallery_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_upper_gallery_fingerprint',true),''),
    '939828b55bd9467be64b3b28cabbf598'),false);
select set_config('hotels_v2.admin_b_expected_ground_version',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_ground_version',true),''),'20'),false);
select set_config('hotels_v2.admin_b_expected_ground_gallery_count',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_ground_gallery_count',true),''),'5'),false);
select set_config('hotels_v2.admin_b_expected_ground_gallery_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_ground_gallery_fingerprint',true),''),
    '1e90ead9d89f58757eebae5268cb50d2'),false);
select set_config('hotels_v2.admin_b_expected_booking_count',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_booking_count',true),''),'3'),false);
select set_config('hotels_v2.admin_b_expected_booking_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_booking_fingerprint',true),''),
    'fb5a4c508b0df32afbffe5b1594c7a50'),false);
select set_config('hotels_v2.admin_b_expected_fulfillment_count',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_fulfillment_count',true),''),'5'),false);
select set_config('hotels_v2.admin_b_expected_fulfillment_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_fulfillment_fingerprint',true),''),
    '1e01541853d87d26adccb8172074934b'),false);
select set_config('hotels_v2.admin_b_expected_deposit_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_deposit_fingerprint',true),''),
    '42b5e1dc9726890e90014c3e89c2329d'),false);
select set_config('hotels_v2.admin_b_expected_coupon_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_coupon_fingerprint',true),''),
    'd41d8cd98f00b204e9800998ecf8427e'),false);
select set_config('hotels_v2.admin_b_expected_h3_1p_target_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_b_expected_h3_1p_target_fingerprint',true),''),
    'baeaae09e1775f28f39695696084f5a1'),false);

do $admin_b_verify$
declare
  c_hotel constant uuid := '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_upper constant uuid := 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94';
  c_ground constant uuid := '825c01b7-9f82-492a-9c81-9b1d5cd7acd3';
  v_missing text[];
  v_policy_names text[];
  v_columns text[];
  v_signature text;
  v_table_name text;
  v_definition text;
  v_snapshot jsonb;
begin
  select coalesce(array_agg(name order by name), '{}'::text[])
  into v_missing
  from unnest(array[
    'public.hotel_property_operational_profiles',
    'public.hotel_admin_assignment_transaction_context'
  ]::text[]) required(name)
  where to_regclass(name) is null;
  if cardinality(v_missing) > 0
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'hotel_room_types'
         and column_name = 'floor_label_i18n' and data_type = 'jsonb'
     ) then
    raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: schema object missing: %',
      array_to_string(v_missing, ',');
  end if;

  select array_agg(column_name order by ordinal_position)
  into v_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'hotel_property_operational_profiles';
  if v_columns is distinct from array[
    'hotel_id','maximum_stay_nights','guest_instructions_i18n',
    'check_in_instructions_i18n','check_out_instructions_i18n',
    'internal_operational_notes','version','created_by','updated_by',
    'created_at','updated_at'
  ]::text[] then
    raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: operational profile schema mismatch';
  end if;

  if exists (select 1 from public.hotel_property_operational_profiles)
     or exists (select 1 from public.hotel_admin_assignment_transaction_context)
     or exists (select 1 from public.hotel_room_types
       where floor_label_i18n <> '{}'::jsonb)
     or not exists (
       select 1 from public.hotel_room_types
       where id = c_upper and hotel_id = c_hotel
         and version = current_setting('hotels_v2.admin_b_expected_upper_version')::bigint
         and jsonb_array_length(gallery) = current_setting(
           'hotels_v2.admin_b_expected_upper_gallery_count')::integer
         and md5(gallery::text) = current_setting(
           'hotels_v2.admin_b_expected_upper_gallery_fingerprint')
     )
     or not exists (
       select 1 from public.hotel_room_types
       where id = c_ground and hotel_id = c_hotel
         and version = current_setting('hotels_v2.admin_b_expected_ground_version')::bigint
         and jsonb_array_length(gallery) = current_setting(
           'hotels_v2.admin_b_expected_ground_gallery_count')::integer
         and md5(gallery::text) = current_setting(
           'hotels_v2.admin_b_expected_ground_gallery_fingerprint')
     ) then
    raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: migration seeded or changed content/Room rows';
  end if;

  if (select count(*) from public.site_settings) <> 1
     or not exists (
       select 1 from public.site_settings where id = 1
         and not hotel_rooms_v2_enabled
         and not hotel_external_sync_enabled
         and not hotel_instant_booking_enabled
         and not hotel_stripe_connect_enabled
     )
     or not exists (
       select 1 from public.hotels where id = c_hotel
         and architecture_version = 'legacy'
         and md5(photos::text) = current_setting(
           'hotels_v2.admin_b_expected_property_gallery_fingerprint')
         and md5(pricing_tiers::text) = '7208ab4ecc0e47abd64d87ca1ac53a03'
         and jsonb_array_length(pricing_tiers -> 'rules') = 63
         and timezone = 'Europe/Nicosia'
         and check_in_from = '14:00'::time
         and check_out_until = '11:00'::time
         and owner_partner_id = current_setting(
           'hotels_v2.admin_b_expected_owner_partner_id')::uuid
     ) then
    raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: flags/legacy Hotel drift';
  end if;

  select array_agg(policyname order by policyname)
  into v_policy_names
  from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'hotels';
  if not coalesce((
       select relrowsecurity from pg_catalog.pg_class
       where oid = 'public.hotels'::regclass
     ), false)
     or not (array[
       'Anyone can view published hotels','hotels_admin_all',
       'hotels_authenticated_select','hotels_partner_delete',
       'hotels_partner_insert','hotels_partner_update'
     ]::text[] <@ coalesce(v_policy_names, '{}'::text[])) then
    raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: public.hotels RLS or required policy missing';
  end if;

  foreach v_table_name in array array[
    'hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
    'hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates',
    'hotel_room_rate_occupancy_tiers','hotel_calendar_overrides',
    'hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
    'hotel_room_allocation_rules','hotel_room_allocation_rule_items',
    'hotel_payment_policies','hotel_payment_policy_terms','hotel_commission_policies',
    'hotel_calendar_source_configs','hotel_pricing_promotion_reviews',
    'hotel_activity_log','hotel_property_operational_profiles'
  ] loop
    if to_regclass('public.' || v_table_name) is not null
       and (
         has_table_privilege(0::oid, ('public.' || v_table_name)::regclass, 'SELECT')
         or has_table_privilege(0::oid, ('public.' || v_table_name)::regclass, 'INSERT')
         or has_table_privilege(0::oid, ('public.' || v_table_name)::regclass, 'UPDATE')
         or has_table_privilege(0::oid, ('public.' || v_table_name)::regclass, 'DELETE')
         or has_table_privilege('anon', 'public.' || v_table_name, 'SELECT')
         or has_table_privilege('anon', 'public.' || v_table_name, 'INSERT')
         or has_table_privilege('anon', 'public.' || v_table_name, 'UPDATE')
         or has_table_privilege('anon', 'public.' || v_table_name, 'DELETE')
         or has_table_privilege('authenticated', 'public.' || v_table_name, 'SELECT')
         or has_table_privilege('authenticated', 'public.' || v_table_name, 'INSERT')
         or has_table_privilege('authenticated', 'public.' || v_table_name, 'UPDATE')
         or has_table_privilege('authenticated', 'public.' || v_table_name, 'DELETE')
         or has_table_privilege('authenticated', 'public.' || v_table_name, 'TRUNCATE')
         or has_table_privilege('authenticated', 'public.' || v_table_name, 'REFERENCES')
         or has_table_privilege('authenticated', 'public.' || v_table_name, 'TRIGGER')
       ) then
      raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: raw browser table privilege: %',
        v_table_name;
    end if;
  end loop;

  -- The shared catalog is deliberately not part of raw normalized hardening.
  if not has_table_privilege('authenticated', 'public.hotel_amenities', 'SELECT') then
    raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: authenticated amenity catalog read regressed';
  end if;

  if not coalesce((select relrowsecurity from pg_catalog.pg_class
        where oid = 'public.hotel_property_operational_profiles'::regclass), false)
     or not coalesce((select relrowsecurity from pg_catalog.pg_class
        where oid = 'public.hotel_admin_assignment_transaction_context'::regclass), false)
     or exists (select 1 from pg_catalog.pg_policy
        where polrelid in (
          'public.hotel_property_operational_profiles'::regclass,
          'public.hotel_admin_assignment_transaction_context'::regclass
        ))
     or has_table_privilege('service_role',
          'public.hotel_property_operational_profiles', 'SELECT')
     or has_table_privilege('authenticated',
          'public.hotel_admin_assignment_transaction_context', 'SELECT') then
    raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: private table security mismatch';
  end if;

  foreach v_signature in array array[
    'public.hotel_v2_admin_get_content_control(uuid)',
    'public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_guest_policy_plan(jsonb,uuid)',
    'public.hotel_v2_admin_create_property_draft(uuid,jsonb,uuid)'
  ] loop
    if to_regprocedure(v_signature) is null
       or not exists (
         select 1 from pg_catalog.pg_proc procedure
         where procedure.oid = v_signature::regprocedure
           and procedure.prokind = 'f'
           and procedure.prosecdef
           and pg_get_userbyid(procedure.proowner) = 'postgres'
           and procedure.proconfig @> array['search_path=pg_catalog, public, auth']
       )
       or has_function_privilege(0::oid, v_signature::regprocedure, 'EXECUTE')
       or has_function_privilege('anon', v_signature, 'EXECUTE')
       or has_function_privilege('service_role', v_signature, 'EXECUTE')
       or not has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: RPC security mismatch: %',
        v_signature;
    end if;
  end loop;

  if has_function_privilege('authenticated',
       'public.hotel_v2_admin_apply_room_type_plan(jsonb,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_admin_apply_workspace_plan_admin_b_core(jsonb,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_admin_apply_guest_policy_plan_admin_b_core(jsonb,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_admin_create_property_draft_admin_b_core(uuid,jsonb,uuid)', 'EXECUTE') then
    raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: old weak writer remains executable';
  end if;

  if not exists (
       select 1 from pg_catalog.pg_trigger
       where tgrelid = 'public.partner_resources'::regclass
         and tgname = 'partner_resources_admin_b_hotel_assignment_lock'
         and tgenabled = 'O' and not tgisinternal
     )
     or not exists (
       select 1 from pg_catalog.pg_trigger
       where tgrelid = 'public.partner_user_resources'::regclass
         and tgname = 'partner_user_resources_admin_b_hotel_scope_guard'
         and tgenabled = 'O' and not tgisinternal
     )
     or not exists (
       select 1 from pg_catalog.pg_trigger
       where tgrelid = 'public.partner_users'::regclass
         and tgname = 'partner_users_admin_b_hotel_scope_reassignment_guard'
         and tgenabled = 'O' and not tgisinternal
     ) then
    raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: assignment integrity trigger missing';
  end if;

  select pg_get_functiondef(
    'public.trg_partner_resources_backfill_service_fulfillments()'::regprocedure
  ) into v_definition;
  if v_definition not like '%hotels_v2_admin_b_future_assignment_only_v1%'
     or v_definition not like '%context_row.assignment_id=NEW.id%'
     or v_definition not like '%context_row.hotel_id=NEW.resource_id%'
     or v_definition not like '%context_row.partner_id=NEW.partner_id%' then
    raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: exact assignment backfill guard missing';
  end if;

  if exists (
       select 1 from public.partner_user_resources scope_row
       join public.partner_users membership on membership.id = scope_row.partner_user_id
       where scope_row.resource_type = 'hotels'
         and not exists (
           select 1 from public.partner_resources assignment
           where assignment.partner_id = membership.partner_id
             and assignment.resource_type = 'hotels'
             and assignment.resource_id = scope_row.resource_id
         )
     ) then
    raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: orphan Hotel staff scope';
  end if;

  v_snapshot := public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  if not coalesce((v_snapshot ->> 'supported')::boolean, false)
     or v_snapshot #>> '{promotion,status}' <> 'reviewed'
     or v_snapshot #>> '{source,pricing_fingerprint}' <> '7208ab4ecc0e47abd64d87ca1ac53a03'
     or v_snapshot #>> '{target,target_fingerprint}' <> current_setting(
       'hotels_v2.admin_b_expected_h3_1p_target_fingerprint')
     or (v_snapshot #>> '{parity,total_case_count}')::integer <> 70
     or (v_snapshot #>> '{parity,total_mismatch_count}')::integer <> 0
     or (v_snapshot #>> '{target,room_schedule,tier_count}')::integer <> 27
     or (v_snapshot #>> '{source,property_party_preview,tier_count}')::integer <> 63
     or (v_snapshot #>> '{target,rate_plan,is_active}')::boolean
     or exists (
       select 1 from jsonb_array_elements(v_snapshot #> '{target,room_rates}') rate
       where (rate ->> 'is_active')::boolean
     ) then
    raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: exact H3.1P pricing snapshot drift';
  end if;

  if (select count(*) from public.hotel_bookings) <>
       current_setting('hotels_v2.admin_b_expected_booking_count')::integer
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|'
          order by row_value.id), '')) from public.hotel_bookings row_value)
          <> current_setting('hotels_v2.admin_b_expected_booking_fingerprint')
     or (select count(*) from public.partner_service_fulfillments
          where resource_type = 'hotels') <>
          current_setting('hotels_v2.admin_b_expected_fulfillment_count')::integer
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|'
          order by row_value.id), '')) from public.partner_service_fulfillments row_value
          where resource_type = 'hotels') <>
          current_setting('hotels_v2.admin_b_expected_fulfillment_fingerprint')
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|'
          order by row_value.id), '')) from public.service_deposit_requests row_value
          where resource_type = 'hotels') <>
          current_setting('hotels_v2.admin_b_expected_deposit_fingerprint')
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|'
          order by row_value.id), '')) from public.service_coupon_redemptions row_value
          where service_type = 'hotels') <>
          current_setting('hotels_v2.admin_b_expected_coupon_fingerprint') then
    raise exception 'HOTELS_V2_ADMIN_B_VERIFY_FAIL: protected booking/commercial history drift';
  end if;
end
$admin_b_verify$;

-- Must match the preflight protected_relation_fingerprints output exactly.
with protected_relations as (
  select coalesce(jsonb_object_agg(
    relation.relname,
    md5(pg_catalog.query_to_xml(format(
      'select to_jsonb(row_value)::text as row_value from public.%I row_value order by to_jsonb(row_value)::text',
      relation.relname
    ), true, true, '')::text)
    order by relation.relname
  ), '{}'::jsonb) fingerprints
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public' and relation.relkind in ('r','p')
    and relation.relname in (
      'hotel_bookings','partner_service_fulfillments',
      'partner_service_fulfillment_form_snapshots','service_deposit_requests',
      'service_deposit_rules','service_deposit_overrides','service_coupons',
      'service_coupon_redemptions','hotel_units','hotel_rate_plans',
      'hotel_room_rates','hotel_rate_rules','hotel_daily_inventory',
      'hotel_daily_rates','hotel_room_rate_occupancy_tiers',
      'hotel_calendar_overrides','hotel_pricing_schedules',
      'hotel_pricing_schedule_occupancy_tiers','hotel_room_allocation_rules',
      'hotel_room_allocation_rule_items','hotel_payment_policies',
      'hotel_payment_policy_terms','hotel_commission_policies',
      'hotel_calendar_source_configs','hotel_pricing_promotion_reviews',
      'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
      'hotel_partner_event_outbox','hotel_activity_log','hotels',
      'partners','partner_users','partner_resources','partner_user_resources',
      'referrals','affiliate_commission_events','affiliate_payouts',
      'affiliate_adjustments','affiliate_program_settings',
      'affiliate_referrer_overrides','affiliate_cashout_requests',
      'profile_referral_code_aliases','site_settings'
    )
),
seven_kamares_expected(persons, rates) as (
  values
    (2, array[100,90,88,84,80,76,74,72,70]::numeric[]),
    (3, array[130,113,113,104,100,95,94,90,90]::numeric[]),
    (4, array[155,135,135,120,118,114,111,107,107]::numeric[]),
    (5, array[200,180,176,168,160,152,148,144,140]::numeric[]),
    (6, array[260,226,226,208,200,190,188,180,180]::numeric[]),
    (7, array[310,270,270,240,236,228,222,214,214]::numeric[]),
    (8, array[310,270,270,240,236,228,222,214,214]::numeric[])
),
seven_kamares_durations(nights) as (
  select generate_series(2,10) union all select 14
),
seven_kamares_replay as (
  select expected.persons, duration.nights,
    least(duration.nights,10)::integer expected_threshold,
    expected.rates[least(duration.nights-1,9)] expected_rate,
    selected.min_nights selected_threshold,
    selected.price_per_night selected_rate
  from seven_kamares_expected expected
  cross join seven_kamares_durations duration
  left join lateral (
    select (rule->>'min_nights')::integer min_nights,
      (rule->>'price_per_night')::numeric price_per_night
    from public.hotels hotel
    cross join lateral jsonb_array_elements(hotel.pricing_tiers->'rules') rule
    where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
      and (rule->>'persons')::integer=expected.persons
      and (rule->>'min_nights')::integer<=duration.nights
    order by (rule->>'min_nights')::integer desc
    limit 1
  ) selected on true
),
legacy_replay as (
  select count(*)::integer case_count,
    count(*) filter(where selected_threshold is distinct from expected_threshold
      or selected_rate is distinct from expected_rate
      or round(selected_rate*nights,2) is distinct from round(expected_rate*nights,2)
    )::integer mismatch_count
  from seven_kamares_replay
),
pricing_snapshot as (
  select public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
  ) value
),
oracle as (
  select
    case when replay.case_count=70 and replay.mismatch_count=0
      and (snapshot.value#>>'{parity,total_case_count}')::integer=70
      and (snapshot.value#>>'{parity,total_mismatch_count}')::integer=0
      then 0 else 1 end hotel_7_arches_occupancy_price_mismatch,
    case when exists(select 1 from public.hotels
        where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
          and md5(pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03'
          and jsonb_array_length(pricing_tiers->'rules')=63)
      and replay.case_count=70 and replay.mismatch_count=0
      then 0 else 1 end hotel_legacy_price_mismatch,
    case when exists(select 1 from public.hotels
        where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid
          and architecture_version='legacy' and is_published)
      and (select count(*) from public.site_settings)=1
      and exists(select 1 from public.site_settings where id=1
        and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
        and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
      and coalesce((select relrowsecurity from pg_catalog.pg_class
        where oid='public.hotels'::regclass),false)
      and (select count(*) from pg_catalog.pg_policies where schemaname='public'
        and tablename='hotels' and policyname=any(array[
          'Anyone can view published hotels','hotels_admin_all',
          'hotels_authenticated_select','hotels_partner_delete',
          'hotels_partner_insert','hotels_partner_update']))=6
      then 0 else 1 end hotel_legacy_public_mismatch,
    case when (select count(*) from public.hotel_bookings)=
        current_setting('hotels_v2.admin_b_expected_booking_count')::integer
      and (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
        order by row_value.id),'')) from public.hotel_bookings row_value)
        =current_setting('hotels_v2.admin_b_expected_booking_fingerprint')
      and (select count(*) from public.partner_service_fulfillments
        where resource_type='hotels')=
        current_setting('hotels_v2.admin_b_expected_fulfillment_count')::integer
      and (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
        order by row_value.id),'')) from public.partner_service_fulfillments row_value
        where resource_type='hotels')=
        current_setting('hotels_v2.admin_b_expected_fulfillment_fingerprint')
      and (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
        order by row_value.id),'')) from public.service_deposit_requests row_value
        where resource_type='hotels')=
        current_setting('hotels_v2.admin_b_expected_deposit_fingerprint')
      and (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
        order by row_value.id),'')) from public.service_coupon_redemptions row_value
        where service_type='hotels')=
        current_setting('hotels_v2.admin_b_expected_coupon_fingerprint')
      then 0 else 1 end hotel_booking_payload_unexplained_difference
  from legacy_replay replay cross join pricing_snapshot snapshot
)
select
  (select version from public.hotel_room_types
    where id = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94') upper_version,
  (select md5(gallery::text) from public.hotel_room_types
    where id = 'b4ef504f-cdeb-4e3c-a54d-932146ef4e94') upper_gallery_fingerprint,
  (select version from public.hotel_room_types
    where id = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3') ground_version,
  (select md5(gallery::text) from public.hotel_room_types
    where id = '825c01b7-9f82-492a-9c81-9b1d5cd7acd3') ground_gallery_fingerprint,
  (select md5(coalesce(string_agg(
      (to_jsonb(row_value) - 'floor_label_i18n')::text, '|'
      order by (to_jsonb(row_value) - 'floor_label_i18n')::text
    ), '')) from public.hotel_room_types row_value)
    room_types_pre_admin_b_semantic_fingerprint,
  protected_relations.fingerprints protected_relation_fingerprints,
  oracle.hotel_7_arches_occupancy_price_mismatch
    as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  oracle.hotel_legacy_price_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  oracle.hotel_legacy_public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  oracle.hotel_booking_payload_unexplained_difference
    as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  true as hotels_v2_admin_b_content_room_assignment_foundation_safe
from protected_relations cross join oracle;
