-- Hotels V2 ADMIN-C pricing-control preflight.
-- READ ONLY. Supabase SQL Editor compatible (no psql meta-commands).
-- Run in a fresh SQL Editor session immediately before migration
-- 20260811350000_hotels_v2_admin_c_pricing_control.sql.
--
-- Frozen prerequisite migration SHA-256 values:
--   ADMIN-A 20260811330000: 9452473a9ae3daa1cd7701eba74ac1b4366903846b9399162035d463f5e91e56
--   ADMIN-B 20260811340000: 94d78d928ea62bbf2258daec6acca51358d04798d721c082eb18028385e1fbf4
-- Save the final protected_relation_fingerprints value. The foundation
-- verifier must return the same value byte-for-byte.

select set_config('hotels_v2.admin_c_expected_booking_count',
  coalesce(nullif(current_setting('hotels_v2.admin_c_expected_booking_count',true),''),'3'),false);
select set_config('hotels_v2.admin_c_expected_booking_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_c_expected_booking_fingerprint',true),''),
    'fb5a4c508b0df32afbffe5b1594c7a50'),false);
select set_config('hotels_v2.admin_c_expected_fulfillment_count',
  coalesce(nullif(current_setting('hotels_v2.admin_c_expected_fulfillment_count',true),''),'5'),false);
select set_config('hotels_v2.admin_c_expected_fulfillment_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_c_expected_fulfillment_fingerprint',true),''),
    '1e01541853d87d26adccb8172074934b'),false);
select set_config('hotels_v2.admin_c_expected_deposit_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_c_expected_deposit_fingerprint',true),''),
    '42b5e1dc9726890e90014c3e89c2329d'),false);
select set_config('hotels_v2.admin_c_expected_coupon_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_c_expected_coupon_fingerprint',true),''),
    'd41d8cd98f00b204e9800998ecf8427e'),false);
select set_config('hotels_v2.admin_c_expected_h3_1p_target_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_c_expected_h3_1p_target_fingerprint',true),''),
    'baeaae09e1775f28f39695696084f5a1'),false);
select set_config('hotels_v2.admin_c_expected_owner_partner_id',
  coalesce(nullif(current_setting('hotels_v2.admin_c_expected_owner_partner_id',true),''),
    '0a321bfe-da6b-43f6-8e0b-7c68546a8b18'),false);

do $admin_c_preflight$
declare
  c_hotel constant uuid := '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_owner constant uuid :=
    current_setting('hotels_v2.admin_c_expected_owner_partner_id')::uuid;
  v_missing text[];
  v_existing text[];
  v_policy_names text[];
  v_snapshot jsonb;
  v_migration_history_ok boolean;
begin
  select coalesce(array_agg(name order by name),'{}'::text[]) into v_missing
  from unnest(array[
    'public.hotels','public.hotel_room_types','public.hotel_units',
    'public.hotel_rate_plans','public.hotel_room_rates',
    'public.hotel_pricing_schedules','public.hotel_pricing_schedule_occupancy_tiers',
    'public.hotel_room_rate_occupancy_tiers','public.hotel_rate_rules',
    'public.hotel_calendar_overrides','public.hotel_daily_rates',
    'public.hotel_daily_inventory','public.hotel_room_allocation_rules',
    'public.hotel_room_allocation_rule_items','public.hotel_pricing_promotion_reviews',
    'public.hotel_activity_log','public.hotel_property_operational_profiles',
    'public.hotel_bookings','public.partner_service_fulfillments',
    'public.partner_service_fulfillment_form_snapshots',
    'public.partner_resources','public.partner_users','public.partner_user_resources',
    'public.hotel_partner_hotel_permissions','public.site_settings'
  ]::text[]) required(name) where to_regclass(name) is null;
  if cardinality(v_missing)>0 then
    raise exception 'HOTELS_V2_ADMIN_C_PREFLIGHT_FAIL: required relations missing: %',
      array_to_string(v_missing,',');
  end if;

  select coalesce(array_agg(name order by name),'{}'::text[]) into v_missing
  from unnest(array[
    'public.hotel_v2_h2a_require_admin()',
    'public.hotel_v2_h2a_keys_allowed(jsonb,text[])',
    'public.hotel_v2_set_updated_at_and_version()',
    'public.hotel_v2_admin_get_content_control(uuid)',
    'public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)',
    'public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)',
    'public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)',
    'public.hotel_v2_h3_1_validate_allocation_rule(uuid)'
  ]::text[]) required(name) where to_regprocedure(name) is null;
  if cardinality(v_missing)>0 then
    raise exception 'HOTELS_V2_ADMIN_C_PREFLIGHT_FAIL: required functions missing: %',
      array_to_string(v_missing,',');
  end if;

  select coalesce(array_agg(name order by name),'{}'::text[]) into v_existing
  from unnest(array[
    'public.hotel_property_pricing_defaults',
    'public.hotel_admin_pricing_action_receipts'
  ]::text[]) expected(name) where to_regclass(name) is not null;
  if cardinality(v_existing)>0
     or to_regprocedure('public.hotel_v2_admin_get_pricing_control(uuid)') is not null
     or to_regprocedure('public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)') is not null
     or to_regprocedure('public.hotel_v2_admin_preview_pricing_quote(jsonb)') is not null
     or exists(select 1 from information_schema.columns where table_schema='public' and (
       (table_name='hotel_rate_plans' and column_name='review_status')
       or (table_name='hotel_room_rates' and column_name='review_status')
       or (table_name='hotel_pricing_schedules' and column_name='sharing_mode')
       or (table_name='hotel_room_allocation_rule_items'
         and column_name in('allocated_guest_counts','pricing_guest_counts'))
       or (table_name='hotel_calendar_overrides' and column_name like 'pricing_%')
     )) then
    raise exception 'HOTELS_V2_ADMIN_C_PREFLIGHT_FAIL: partial or repeated ADMIN-C schema';
  end if;

  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select exists(select 1 from supabase_migrations.schema_migrations '
      ||'where version=''20260811330000'') and exists(select 1 from '
      ||'supabase_migrations.schema_migrations where version=''20260811340000'')'
      into v_migration_history_ok;
    if not v_migration_history_ok then
      raise exception 'HOTELS_V2_ADMIN_C_PREFLIGHT_FAIL: ADMIN-A/B migration ledger prerequisite missing';
    end if;
  end if;

  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1
       and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
       and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled) then
    raise exception 'HOTELS_V2_ADMIN_C_PREFLIGHT_FAIL: exact id=1 Hotels V2 flags are not all OFF';
  end if;

  select array_agg(policyname order by policyname) into v_policy_names
  from pg_catalog.pg_policies where schemaname='public' and tablename='hotels';
  if not coalesce((select relrowsecurity from pg_catalog.pg_class
       where oid='public.hotels'::regclass),false)
     or not (array[
       'Anyone can view published hotels','hotels_admin_all',
       'hotels_authenticated_select','hotels_partner_delete',
       'hotels_partner_insert','hotels_partner_update'
     ]::text[] <@ coalesce(v_policy_names,'{}'::text[])) then
    raise exception 'HOTELS_V2_ADMIN_C_PREFLIGHT_FAIL: public.hotels structural RLS drift';
  end if;

  if not exists(select 1 from public.hotels hotel where hotel.id=c_hotel
       and hotel.architecture_version='legacy' and hotel.is_published
       and hotel.owner_partner_id=c_owner and hotel.timezone='Europe/Nicosia'
       and hotel.currency='EUR' and hotel.check_in_from='14:00'::time
       and hotel.check_out_until='11:00'::time
       and hotel.minimum_stay_nights=2 and hotel.booking_mode='request_confirmation'
       and hotel.children_policy='minimum_age' and hotel.minimum_child_age=15
       and md5(hotel.pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03'
       and jsonb_array_length(hotel.pricing_tiers->'rules')=63)
     or (select count(*) from public.hotel_room_types where hotel_id=c_hotel)<>2
     or (select count(*) from public.hotel_rate_plans)<>1
     or not exists(select 1 from public.hotel_rate_plans where
       id='22e47a63-a630-4fb6-8f43-816f2d3fdc17' and hotel_id=c_hotel and not is_active)
     or (select count(*) from public.hotel_room_rates)<>2
     or (select count(*) from public.hotel_room_rates where hotel_id=c_hotel and not is_active)<>2
     or (select count(*) from public.hotel_pricing_schedules)<>2
     or (select count(*) from public.hotel_pricing_schedules where hotel_id=c_hotel and not is_active)<>2
     or (select count(*) from public.hotel_room_allocation_rules where hotel_id=c_hotel)<>5
     or (select count(*) from public.hotel_room_allocation_rule_items where hotel_id=c_hotel)<>10
     or exists(select 1 from public.hotel_room_allocation_rule_items where units_required>1) then
    raise exception 'HOTELS_V2_ADMIN_C_PREFLIGHT_FAIL: exact accepted H3.1P graph baseline drift';
  end if;

  v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  if not coalesce((v_snapshot->>'supported')::boolean,false)
     or v_snapshot#>>'{promotion,status}'<>'reviewed'
     or v_snapshot#>>'{source,pricing_fingerprint}'<>'7208ab4ecc0e47abd64d87ca1ac53a03'
     or (v_snapshot#>>'{source,rule_count}')::integer<>63
     or v_snapshot#>>'{target,target_fingerprint}'<>
       current_setting('hotels_v2.admin_c_expected_h3_1p_target_fingerprint')
     or v_snapshot->>'pricing_occupancy_mapping_fingerprint'<>
       '6f6e6c64f0b0d0aa60e3575d4fd4ac1c'
     or v_snapshot#>>'{parity,fingerprint}'<>'b3c915266ab060efaba522cf5587fb75'
     or (v_snapshot#>>'{parity,total_case_count}')::integer<>70
     or (v_snapshot#>>'{parity,total_mismatch_count}')::integer<>0
     or (v_snapshot#>>'{target,room_schedule,tier_count}')::integer<>27
     or (v_snapshot#>>'{source,property_party_preview,tier_count}')::integer<>63
     or not coalesce((v_snapshot#>>'{safety,all_flags_off}')::boolean,false)
     or not coalesce((v_snapshot#>>'{safety,rate_plan_inactive}')::boolean,false)
     or not coalesce((v_snapshot#>>'{safety,room_rates_inactive}')::boolean,false) then
    raise exception 'HOTELS_V2_ADMIN_C_PREFLIGHT_FAIL: H3.1P snapshot drift: %',
      v_snapshot->'blockers';
  end if;

  if exists(select 1 from public.partner_user_resources scope_row
      join public.partner_users membership on membership.id=scope_row.partner_user_id
      where scope_row.resource_type='hotels' and not exists(
        select 1 from public.partner_resources assignment
        where assignment.partner_id=membership.partner_id
          and assignment.resource_type='hotels'
          and assignment.resource_id=scope_row.resource_id)) then
    raise exception 'HOTELS_V2_ADMIN_C_PREFLIGHT_FAIL: orphan Hotel staff scope';
  end if;

  if (select count(*) from public.hotel_bookings)<>
       current_setting('hotels_v2.admin_c_expected_booking_count')::integer
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
          order by row_value.id),'')) from public.hotel_bookings row_value)<>
       current_setting('hotels_v2.admin_c_expected_booking_fingerprint')
     or (select count(*) from public.partner_service_fulfillments
          where resource_type='hotels')<>
       current_setting('hotels_v2.admin_c_expected_fulfillment_count')::integer
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
          order by row_value.id),'')) from public.partner_service_fulfillments row_value
          where resource_type='hotels')<>
       current_setting('hotels_v2.admin_c_expected_fulfillment_fingerprint')
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
          order by row_value.id),'')) from public.service_deposit_requests row_value
          where resource_type='hotels')<>
       current_setting('hotels_v2.admin_c_expected_deposit_fingerprint')
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
          order by row_value.id),'')) from public.service_coupon_redemptions row_value
          where service_type='hotels')<>
       current_setting('hotels_v2.admin_c_expected_coupon_fingerprint') then
    raise exception 'HOTELS_V2_ADMIN_C_PREFLIGHT_FAIL: protected commercial/history drift';
  end if;
end
$admin_c_preflight$;

with relation_specs(relation_name,excluded_columns) as (
  values
    ('hotels','{}'::text[]),('hotel_room_types','{}'::text[]),
    ('hotel_units','{}'::text[]),('hotel_rate_plans',array['review_status']::text[]),
    ('hotel_room_rates',array['review_status']::text[]),
    ('hotel_pricing_schedules',array['sharing_mode']::text[]),
    ('hotel_pricing_schedule_occupancy_tiers','{}'::text[]),
    ('hotel_room_rate_occupancy_tiers','{}'::text[]),('hotel_rate_rules','{}'::text[]),
    ('hotel_daily_rates','{}'::text[]),('hotel_daily_inventory','{}'::text[]),
    ('hotel_calendar_overrides',array['pricing_source','pricing_reason',
      'pricing_expires_at','pricing_actor_type','pricing_actor_id',
      'pricing_updated_at','pricing_correlation_id']::text[]),
    ('hotel_room_allocation_rules','{}'::text[]),
    ('hotel_room_allocation_rule_items',array[
      'allocated_guest_counts','pricing_guest_counts']::text[]),
    ('hotel_pricing_promotion_reviews','{}'::text[]),
    ('hotel_bookings','{}'::text[]),('partner_service_fulfillments','{}'::text[]),
    ('partner_service_fulfillment_form_snapshots','{}'::text[]),
    ('service_deposit_requests','{}'::text[]),('service_deposit_rules','{}'::text[]),
    ('service_deposit_overrides','{}'::text[]),('service_coupons','{}'::text[]),
    ('service_coupon_redemptions','{}'::text[]),('referrals','{}'::text[]),
    ('affiliate_commission_events','{}'::text[]),('affiliate_payouts','{}'::text[]),
    ('affiliate_adjustments','{}'::text[]),('affiliate_program_settings','{}'::text[]),
    ('affiliate_referrer_overrides','{}'::text[]),
    ('affiliate_cashout_requests','{}'::text[]),
    ('profile_referral_code_aliases','{}'::text[]),('site_settings','{}'::text[]),
    ('partners','{}'::text[]),('partner_users','{}'::text[]),
    ('partner_resources','{}'::text[]),('partner_user_resources','{}'::text[]),
    ('hotel_property_operational_profiles','{}'::text[]),
    ('hotel_calendar_source_configs','{}'::text[]),
    ('hotel_payment_policies','{}'::text[]),('hotel_payment_policy_terms','{}'::text[]),
    ('hotel_commission_policies','{}'::text[]),
    ('hotel_partner_hotel_permissions','{}'::text[]),
    ('hotel_partner_action_receipts','{}'::text[]),
    ('hotel_partner_event_outbox','{}'::text[]),('hotel_activity_log','{}'::text[])
), protected_relations as (
  select coalesce(jsonb_object_agg(spec.relation_name,
    md5(pg_catalog.query_to_xml(format(
      'select (to_jsonb(row_value)-%L::text[])::text as row_value '
      ||'from public.%I row_value order by (to_jsonb(row_value)-%L::text[])::text',
      spec.excluded_columns,spec.relation_name,spec.excluded_columns
    ),true,true,'')::text) order by spec.relation_name),'{}'::jsonb) fingerprints
  from relation_specs spec where to_regclass('public.'||spec.relation_name) is not null
), seven_kamares_expected(persons,rates) as (
  values
    (2,array[100,90,88,84,80,76,74,72,70]::numeric[]),
    (3,array[130,113,113,104,100,95,94,90,90]::numeric[]),
    (4,array[155,135,135,120,118,114,111,107,107]::numeric[]),
    (5,array[200,180,176,168,160,152,148,144,140]::numeric[]),
    (6,array[260,226,226,208,200,190,188,180,180]::numeric[]),
    (7,array[310,270,270,240,236,228,222,214,214]::numeric[]),
    (8,array[310,270,270,240,236,228,222,214,214]::numeric[])
), seven_kamares_durations(nights) as (
  select generate_series(2,10) union all select 14
), replay as (
  select expected.persons,duration.nights,
    expected.rates[least(duration.nights-1,9)] expected_rate,
    selected.price_per_night selected_rate,selected.min_nights selected_threshold
  from seven_kamares_expected expected cross join seven_kamares_durations duration
  left join lateral (
    select (rule->>'min_nights')::integer min_nights,
      (rule->>'price_per_night')::numeric price_per_night
    from public.hotels hotel cross join lateral
      jsonb_array_elements(hotel.pricing_tiers->'rules') rule
    where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
      and (rule->>'persons')::integer=expected.persons
      and (rule->>'min_nights')::integer<=duration.nights
    order by (rule->>'min_nights')::integer desc limit 1
  ) selected on true
), oracle as (
  select count(*)::integer case_count,
    count(*) filter(where selected_rate is distinct from expected_rate
      or selected_threshold is distinct from least(nights,10))::integer mismatch_count
  from replay
)
select protected_relations.fingerprints protected_relation_fingerprints,
  case when oracle.case_count=70 and oracle.mismatch_count=0
    and (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{parity,total_mismatch_count}')::integer=0
    then 0 else 1 end as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  case when oracle.case_count=70 and oracle.mismatch_count=0 and exists(
    select 1 from public.hotels where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
      and md5(pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03')
    then 0 else 1 end as "HOTEL_LEGACY_PRICE_MISMATCH",
  case when exists(select 1 from public.hotels where
      id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and architecture_version='legacy'
      and is_published)
    and (select count(*) from public.site_settings)=1
    and exists(select 1 from public.site_settings where id=1
      and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
      and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
    and coalesce((select relrowsecurity from pg_class where oid='public.hotels'::regclass),false)
    and (select count(*) from pg_policies where schemaname='public' and tablename='hotels'
      and policyname=any(array['Anyone can view published hotels','hotels_admin_all',
        'hotels_authenticated_select','hotels_partner_delete','hotels_partner_insert',
        'hotels_partner_update']))=6
    then 0 else 1 end as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  case when (select count(*) from public.hotel_bookings)=
      current_setting('hotels_v2.admin_c_expected_booking_count')::integer
    and (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
      order by row_value.id),'')) from public.hotel_bookings row_value)=
      current_setting('hotels_v2.admin_c_expected_booking_fingerprint')
    and (select count(*) from public.partner_service_fulfillments
      where resource_type='hotels')=
      current_setting('hotels_v2.admin_c_expected_fulfillment_count')::integer
    and (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
      order by row_value.id),'')) from public.partner_service_fulfillments row_value
      where resource_type='hotels')=
      current_setting('hotels_v2.admin_c_expected_fulfillment_fingerprint')
    and (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
      order by row_value.id),'')) from public.service_deposit_requests row_value
      where resource_type='hotels')=
      current_setting('hotels_v2.admin_c_expected_deposit_fingerprint')
    and (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
      order by row_value.id),'')) from public.service_coupon_redemptions row_value
      where service_type='hotels')=
      current_setting('hotels_v2.admin_c_expected_coupon_fingerprint')
    then 0 else 1 end as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  true as hotels_v2_admin_c_pricing_control_preflight_safe
from protected_relations cross join oracle;
