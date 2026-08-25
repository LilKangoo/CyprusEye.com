-- Hotels V2 ADMIN-C post-Admin verification.
-- READ ONLY. Supabase SQL Editor compatible (no psql meta-commands).
-- Run after reviewed ADMIN-C saves. Future-Hotel pricing graph rows, ADMIN-C
-- receipts, and ADMIN-C activity are expected to differ. The accepted 7
-- Kamares H3.1P graph, public architecture/flags, and commercial history are not.

select set_config('hotels_v2.admin_c_expected_booking_count',
  coalesce(nullif(current_setting('hotels_v2.admin_c_expected_booking_count',true),''),'3'),false);
select set_config('hotels_v2.admin_c_expected_fulfillment_count',
  coalesce(nullif(current_setting('hotels_v2.admin_c_expected_fulfillment_count',true),''),'5'),false);
select set_config('hotels_v2.admin_c_expected_booking_fingerprint',
  coalesce(nullif(current_setting('hotels_v2.admin_c_expected_booking_fingerprint',true),''),
    'fb5a4c508b0df32afbffe5b1594c7a50'),false);
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

do $admin_c_post_admin$
declare
  c_hotel constant uuid := '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_hotel_id uuid;
  v_rule_id uuid;
  v_signature text;
  v_snapshot jsonb;
begin
  if to_regclass('public.hotel_property_pricing_defaults') is null
     or to_regclass('public.hotel_admin_pricing_action_receipts') is null
     or to_regprocedure('public.hotel_v2_admin_get_pricing_control(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)') is null
     or to_regprocedure('public.hotel_v2_admin_preview_pricing_quote(jsonb)') is null then
    raise exception 'HOTELS_V2_ADMIN_C_POST_ADMIN_FAIL: ADMIN-C foundation missing';
  end if;

  if exists(select 1 from unnest(array[
      'hotel_property_pricing_defaults','hotel_admin_pricing_action_receipts',
      'hotel_rate_plans','hotel_room_rates','hotel_pricing_schedules',
      'hotel_pricing_schedule_occupancy_tiers','hotel_room_rate_occupancy_tiers',
      'hotel_rate_rules','hotel_calendar_overrides','hotel_room_allocation_rules',
      'hotel_room_allocation_rule_items','hotel_daily_rates','hotel_activity_log',
      'hotel_pricing_promotion_reviews'
    ]::text[]) relation_name where
      has_table_privilege('anon','public.'||relation_name,'SELECT')
      or has_table_privilege('anon','public.'||relation_name,'INSERT')
      or has_table_privilege('anon','public.'||relation_name,'UPDATE')
      or has_table_privilege('anon','public.'||relation_name,'DELETE')
      or has_table_privilege('authenticated','public.'||relation_name,'SELECT')
      or has_table_privilege('authenticated','public.'||relation_name,'INSERT')
      or has_table_privilege('authenticated','public.'||relation_name,'UPDATE')
      or has_table_privilege('authenticated','public.'||relation_name,'DELETE')
      or exists(select 1 from pg_class relation_row
        join pg_namespace namespace_row on namespace_row.oid=relation_row.relnamespace
        cross join lateral aclexplode(coalesce(relation_row.relacl,
          acldefault('r',relation_row.relowner))) privilege_row
        where namespace_row.nspname='public' and relation_row.relname=relation_name
          and privilege_row.grantee=0
          and privilege_row.privilege_type in('SELECT','INSERT','UPDATE','DELETE'))) then
    raise exception 'HOTELS_V2_ADMIN_C_POST_ADMIN_FAIL: raw pricing ACL exposed';
  end if;

  foreach v_signature in array array[
    'public.hotel_v2_admin_get_pricing_control(uuid)',
    'public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)',
    'public.hotel_v2_admin_preview_pricing_quote(jsonb)',
    'public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)',
    'public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)'
  ] loop
    if to_regprocedure(v_signature) is null
       or not has_function_privilege('authenticated',v_signature,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE')
       or not (select procedure_row.proowner='postgres'::regrole
          and procedure_row.prosecdef
          and procedure_row.proconfig=
            array['search_path=pg_catalog, public, auth']::text[]
        from pg_proc procedure_row
        where procedure_row.oid=to_regprocedure(v_signature))
       or exists(select 1 from pg_proc procedure_row
         cross join lateral aclexplode(coalesce(procedure_row.proacl,
           acldefault('f',procedure_row.proowner))) privilege_row
         where procedure_row.oid=to_regprocedure(v_signature)
           and privilege_row.grantee=0
           and privilege_row.privilege_type='EXECUTE') then
      raise exception 'HOTELS_V2_ADMIN_C_POST_ADMIN_FAIL: public RPC ACL mismatch: %',
        v_signature;
    end if;
  end loop;

  if not has_function_privilege('service_role',
       'public.hotel_v2_admin_c_guest_array_matches_total(smallint[],integer,smallint)',
       'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_admin_c_guest_array_matches_total(smallint[],integer,smallint)',
       'EXECUTE')
     or has_function_privilege('authenticated',
       'public.hotel_v2_admin_c_guest_array_matches_total(smallint[],integer,smallint)',
       'EXECUTE')
     or not (select procedure_row.proowner='postgres'::regrole
          and not procedure_row.prosecdef
          and procedure_row.proconfig=array['search_path=pg_catalog']::text[]
        from pg_proc procedure_row where procedure_row.oid=to_regprocedure(
          'public.hotel_v2_admin_c_guest_array_matches_total(smallint[],integer,smallint)'))
     or exists(select 1 from pg_proc procedure_row
       join pg_namespace namespace_row on namespace_row.oid=procedure_row.pronamespace
       where namespace_row.nspname='public'
         and (left(procedure_row.proname,length('hotel_v2_admin_c_'))=
             'hotel_v2_admin_c_'
           or right(procedure_row.proname,length('_admin_c_core'))=
             '_admin_c_core')
         and procedure_row.proname<>'hotel_v2_admin_c_guest_array_matches_total'
         and (procedure_row.proowner<>'postgres'::regrole
           or (procedure_row.proconfig is distinct from
                 array['search_path=pg_catalog']::text[]
             and procedure_row.proconfig is distinct from
                 array['search_path=pg_catalog, public']::text[])
           or (procedure_row.prosecdef and procedure_row.proconfig is distinct from
             array['search_path=pg_catalog, public']::text[])
           or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
           or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
           or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
           or exists(select 1 from aclexplode(coalesce(procedure_row.proacl,
             acldefault('f',procedure_row.proowner))) privilege_row
             where privilege_row.grantee=0
               and privilege_row.privilege_type='EXECUTE'))) then
    raise exception 'HOTELS_V2_ADMIN_C_POST_ADMIN_FAIL: internal helper ACL mismatch';
  end if;

  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1
       and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
       and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)
     or not exists(select 1 from public.hotels where id=c_hotel
       and architecture_version='legacy' and is_published
       and md5(pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03'
       and jsonb_array_length(pricing_tiers->'rules')=63)
     or exists(select 1 from public.hotel_rate_plans where hotel_id=c_hotel and is_active)
     or exists(select 1 from public.hotel_room_rates where hotel_id=c_hotel and is_active)
     or exists(select 1 from public.hotel_pricing_schedules where hotel_id=c_hotel and is_active)
     or exists(select 1 from public.hotel_property_pricing_defaults where hotel_id=c_hotel)
     or exists(select 1 from public.hotel_admin_pricing_action_receipts where hotel_id=c_hotel) then
    raise exception 'HOTELS_V2_ADMIN_C_POST_ADMIN_FAIL: flags/public/7K immutable boundary changed';
  end if;

  v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  if not coalesce((v_snapshot->>'supported')::boolean,false)
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
     or v_snapshot#>>'{promotion,status}'<>'reviewed'
     or v_snapshot#>>'{source,pricing_fingerprint}'<>'7208ab4ecc0e47abd64d87ca1ac53a03'
     or v_snapshot#>>'{target,target_fingerprint}'<>
       current_setting('hotels_v2.admin_c_expected_h3_1p_target_fingerprint')
     or v_snapshot->>'pricing_occupancy_mapping_fingerprint'<>
       '6f6e6c64f0b0d0aa60e3575d4fd4ac1c'
     or v_snapshot#>>'{parity,fingerprint}'<>'b3c915266ab060efaba522cf5587fb75'
     or (v_snapshot#>>'{parity,total_case_count}')::integer<>70
     or (v_snapshot#>>'{parity,total_mismatch_count}')::integer<>0
     or (v_snapshot#>>'{target,room_schedule,tier_count}')::integer<>27
     or (v_snapshot#>>'{source,property_party_preview,tier_count}')::integer<>63 then
    raise exception 'HOTELS_V2_ADMIN_C_POST_ADMIN_FAIL: H3.1P pricing oracle changed';
  end if;

  if exists(select 1 from public.hotel_admin_pricing_action_receipts receipt where
       receipt.request_hash!~'^[0-9a-f]{64}$'
       or jsonb_typeof(receipt.result)<>'object'
       or receipt.result->>'contract_version'<>'hotels_v2_admin_c_pricing_plan_v1'
       or receipt.result->>'hotel_id' is distinct from receipt.hotel_id::text
       or receipt.result->>'correlation_id' is distinct from receipt.correlation_id::text)
     or exists(select actor_id,idempotency_key from public.hotel_admin_pricing_action_receipts
       group by actor_id,idempotency_key having count(*)>1)
     or exists(select correlation_id from public.hotel_admin_pricing_action_receipts
       group by correlation_id having count(*)>1) then
    raise exception 'HOTELS_V2_ADMIN_C_POST_ADMIN_FAIL: idempotency receipt contract invalid';
  end if;

  if exists(select 1 from public.hotel_calendar_overrides override_row where
      ((override_row.nightly_rate_mode is null
        and override_row.minimum_stay_mode is null
        and override_row.maximum_stay_mode is null) and (
          override_row.pricing_source is not null or override_row.pricing_reason is not null
          or override_row.pricing_expires_at is not null
          or override_row.pricing_actor_type is not null
          or override_row.pricing_actor_id is not null
          or override_row.pricing_updated_at is not null
          or override_row.pricing_correlation_id is not null))
      or ((override_row.nightly_rate_mode is not null
        or override_row.minimum_stay_mode is not null
        or override_row.maximum_stay_mode is not null)
        and override_row.pricing_source is not null and (
          override_row.pricing_source not in('manual','partner','sync','system')
          or override_row.pricing_reason is null
          or override_row.pricing_reason<>btrim(override_row.pricing_reason)
          or length(override_row.pricing_reason) not between 1 and 500
          or override_row.pricing_reason~'[[:cntrl:]]'
          or override_row.pricing_actor_type not in('admin','partner','sync','system')
          or (override_row.pricing_actor_type in('admin','partner')
            and override_row.pricing_actor_id is null)
          or override_row.pricing_updated_at is null
          or override_row.pricing_correlation_id is null))) then
    raise exception 'HOTELS_V2_ADMIN_C_POST_ADMIN_FAIL: exact-date pricing provenance invalid';
  end if;

  for v_hotel_id in select hotel.id from public.hotels hotel order by hotel.id loop
    perform public.hotel_v2_admin_c_validate_pricing_graph(v_hotel_id);
  end loop;
  for v_rule_id in select rule.id from public.hotel_room_allocation_rules rule
      order by rule.id loop
    perform public.hotel_v2_h3_1_validate_allocation_rule(v_rule_id);
    perform public.hotel_v2_admin_c_validate_allocation_extensions(v_rule_id);
  end loop;

  if exists(select 1 from public.partner_user_resources scope_row
      join public.partner_users membership on membership.id=scope_row.partner_user_id
      where scope_row.resource_type='hotels' and not exists(
        select 1 from public.partner_resources assignment
        where assignment.partner_id=membership.partner_id
          and assignment.resource_type='hotels'
          and assignment.resource_id=scope_row.resource_id)) then
    raise exception 'HOTELS_V2_ADMIN_C_POST_ADMIN_FAIL: Hotel assignment scope invariant failed';
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
    raise exception 'HOTELS_V2_ADMIN_C_POST_ADMIN_FAIL: protected commercial history changed';
  end if;
end
$admin_c_post_admin$;

with protected_history_relations(relation_name) as (
  select unnest(array[
    'hotels','hotel_room_types','hotel_units','site_settings',
    'hotel_property_operational_profiles','hotel_daily_inventory','hotel_daily_rates',
    'hotel_calendar_source_configs','hotel_payment_policies',
    'hotel_payment_policy_terms','hotel_commission_policies',
    'hotel_pricing_promotion_reviews',
    'hotel_bookings','partner_service_fulfillments',
    'partner_service_fulfillment_form_snapshots','service_deposit_requests',
    'service_deposit_rules','service_deposit_overrides','service_coupons',
    'service_coupon_redemptions','referrals','affiliate_commission_events',
    'affiliate_payouts','affiliate_adjustments','affiliate_program_settings',
    'affiliate_referrer_overrides','affiliate_cashout_requests',
    'profile_referral_code_aliases','partners','partner_users','partner_resources',
    'partner_user_resources','hotel_partner_hotel_permissions',
    'hotel_partner_action_receipts','hotel_partner_event_outbox'
  ]::text[])
), protected_history as (
  select coalesce(jsonb_object_agg(relation_name,
    md5(pg_catalog.query_to_xml(format(
      'select to_jsonb(row_value)::text as row_value from public.%I row_value '
      ||'order by to_jsonb(row_value)::text',relation_name),true,true,'')::text)
    order by relation_name),'{}'::jsonb) fingerprints
  from protected_history_relations where to_regclass('public.'||relation_name) is not null
), reviewed_admin_state as (
  select jsonb_build_object(
    'property_pricing_defaults',md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|'
      order by row_value.id) from public.hotel_property_pricing_defaults row_value),'')),
    'rate_plans',md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|'
      order by row_value.id) from public.hotel_rate_plans row_value),'')),
    'room_rates',md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|'
      order by row_value.id) from public.hotel_room_rates row_value),'')),
    'pricing_schedules',md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|'
      order by row_value.id) from public.hotel_pricing_schedules row_value),'')),
    'pricing_schedule_occupancy_tiers',md5(coalesce((select string_agg(
      to_jsonb(row_value)::text,'|' order by row_value.id)
      from public.hotel_pricing_schedule_occupancy_tiers row_value),'')),
    'room_rate_occupancy_tiers',md5(coalesce((select string_agg(
      to_jsonb(row_value)::text,'|' order by row_value.id)
      from public.hotel_room_rate_occupancy_tiers row_value),'')),
    'rate_rules',md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|'
      order by row_value.id) from public.hotel_rate_rules row_value),'')),
    'calendar_overrides',md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|'
      order by row_value.id) from public.hotel_calendar_overrides row_value),'')),
    'allocation_rules',md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|'
      order by row_value.id) from public.hotel_room_allocation_rules row_value),'')),
    'allocation_rule_items',md5(coalesce((select string_agg(
      to_jsonb(row_value)::text,'|' order by row_value.id)
      from public.hotel_room_allocation_rule_items row_value),'')),
    'pricing_receipts',md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|'
      order by row_value.id) from public.hotel_admin_pricing_action_receipts row_value),'')),
    'activity',md5(coalesce((select string_agg(to_jsonb(row_value)::text,'|'
      order by row_value.id) from public.hotel_activity_log row_value),''))
  ) fingerprints
), expected(persons,rates) as (
  values
    (2,array[100,90,88,84,80,76,74,72,70]::numeric[]),
    (3,array[130,113,113,104,100,95,94,90,90]::numeric[]),
    (4,array[155,135,135,120,118,114,111,107,107]::numeric[]),
    (5,array[200,180,176,168,160,152,148,144,140]::numeric[]),
    (6,array[260,226,226,208,200,190,188,180,180]::numeric[]),
    (7,array[310,270,270,240,236,228,222,214,214]::numeric[]),
    (8,array[310,270,270,240,236,228,222,214,214]::numeric[])
), durations(nights) as (select generate_series(2,10) union all select 14),
replay as (
  select expected.persons,durations.nights,
    expected.rates[least(durations.nights-1,9)] expected_rate,
    selected.price_per_night selected_rate,selected.min_nights selected_threshold
  from expected cross join durations left join lateral (
    select (rule->>'min_nights')::integer min_nights,
      (rule->>'price_per_night')::numeric price_per_night
    from public.hotels hotel cross join lateral
      jsonb_array_elements(hotel.pricing_tiers->'rules') rule
    where hotel.id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
      and (rule->>'persons')::integer=expected.persons
      and (rule->>'min_nights')::integer<=durations.nights
    order by (rule->>'min_nights')::integer desc limit 1
  ) selected on true
), oracle as (
  select count(*)::integer case_count,
    count(*) filter(where selected_rate is distinct from expected_rate
      or selected_threshold is distinct from least(nights,10))::integer mismatch_count
  from replay
)
select protected_history.fingerprints protected_history_fingerprints,
  reviewed_admin_state.fingerprints reviewed_admin_state,
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
  true as hotels_v2_admin_c_pricing_control_post_admin_safe
from protected_history cross join reviewed_admin_state cross join oracle;
