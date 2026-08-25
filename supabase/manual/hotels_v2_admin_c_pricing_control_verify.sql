-- Hotels V2 ADMIN-C pricing-control foundation verification.
-- READ ONLY. Supabase SQL Editor compatible (no psql meta-commands).
-- Run in a fresh SQL Editor session immediately after migration
-- 20260811350000 and before any ADMIN-C save. Compare the final
-- protected_relation_fingerprints byte-for-byte with preflight output.

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

do $admin_c_verify$
declare
  c_hotel constant uuid := '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_missing text[];
  v_columns text[];
  v_policy_names text[];
  v_signature text;
  v_snapshot jsonb;
  v_definition text;
begin
  select coalesce(array_agg(name order by name),'{}'::text[]) into v_missing
  from unnest(array[
    'public.hotel_property_pricing_defaults',
    'public.hotel_admin_pricing_action_receipts'
  ]::text[]) required(name) where to_regclass(name) is null;
  if cardinality(v_missing)>0 then
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: relation missing: %',
      array_to_string(v_missing,',');
  end if;

  select coalesce(array_agg(name order by name),'{}'::text[]) into v_missing
  from unnest(array[
    'public.hotel_v2_admin_get_pricing_control(uuid)',
    'public.hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)',
    'public.hotel_v2_admin_preview_pricing_quote(jsonb)',
    'public.hotel_v2_admin_c_pricing_control_snapshot(uuid)',
    'public.hotel_v2_admin_c_validate_pricing_graph(uuid)',
    'public.hotel_v2_admin_c_enforce_graph_limits(uuid,integer,integer,integer,integer,integer,integer,integer,integer,integer)',
    'public.hotel_v2_admin_c_validate_allocation_extensions(uuid)',
    'public.hotel_v2_admin_c_child_slots_are_feasible(smallint[],smallint[],smallint[])',
    'public.hotel_v2_admin_c_guest_array_matches_total(smallint[],integer,smallint)',
    'public.hotel_v2_admin_c_uuid_is_canonical(text)',
    'public.hotel_v2_admin_c_json_uuid_fields_are_canonical(jsonb)',
    'public.hotel_v2_admin_c_date_is_canonical(text)',
    'public.hotel_v2_admin_c_timestamptz_is_canonical(text)',
    'public.hotel_v2_admin_c_json_timestamp_fields_are_canonical(jsonb)',
    'public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()',
    'public.hotel_v2_admin_apply_workspace_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_calendar_plan(jsonb,uuid)',
    'public.hotel_v2_admin_apply_h3_1_configuration(jsonb,uuid)',
    'public.hotel_v2_admin_apply_legacy_pricing_promotion(jsonb,uuid)'
  ]::text[]) required(name) where to_regprocedure(name) is null;
  if cardinality(v_missing)>0 then
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: function missing: %',
      array_to_string(v_missing,',');
  end if;

  select array_agg(column_name order by ordinal_position) into v_columns
  from information_schema.columns where table_schema='public'
    and table_name='hotel_property_pricing_defaults';
  if v_columns is distinct from array[
    'id','hotel_id','nightly_rate','currency','is_active','review_status',
    'version','created_at','updated_at'
  ]::text[] then
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: property-default schema mismatch';
  end if;

  select array_agg(column_name order by ordinal_position) into v_columns
  from information_schema.columns where table_schema='public'
    and table_name='hotel_admin_pricing_action_receipts';
  if v_columns is distinct from array[
    'id','hotel_id','actor_id','idempotency_key','correlation_id','request_hash',
    'result','created_at'
  ]::text[] then
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: receipt schema mismatch';
  end if;

  if not exists(select 1 from information_schema.columns where table_schema='public'
       and table_name='hotel_rate_plans' and column_name='review_status'
       and column_default like '%requires_review%')
     or not exists(select 1 from information_schema.columns where table_schema='public'
       and table_name='hotel_room_rates' and column_name='review_status'
       and column_default like '%requires_review%')
     or not exists(select 1 from information_schema.columns where table_schema='public'
       and table_name='hotel_pricing_schedules' and column_name='sharing_mode')
     or (select count(*) from information_schema.columns where table_schema='public'
       and table_name='hotel_calendar_overrides' and column_name in(
         'pricing_source','pricing_reason','pricing_expires_at','pricing_actor_type',
         'pricing_actor_id','pricing_updated_at','pricing_correlation_id'))<>7
     or (select count(*) from information_schema.columns where table_schema='public'
       and table_name='hotel_room_allocation_rule_items' and column_name in(
         'allocated_guest_counts','pricing_guest_counts'))<>2 then
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: additive columns/defaults mismatch';
  end if;

  if exists(select 1 from public.hotel_property_pricing_defaults)
     or exists(select 1 from public.hotel_admin_pricing_action_receipts)
     or (select count(*) from public.hotel_rate_plans where review_status='reviewed')<>1
     or exists(select 1 from public.hotel_rate_plans where review_status<>'reviewed')
     or (select count(*) from public.hotel_room_rates where review_status='reviewed')<>2
     or exists(select 1 from public.hotel_room_rates where review_status<>'reviewed')
     or exists(select 1 from public.hotel_pricing_schedules where sharing_mode<>'shared')
     or exists(select 1 from public.hotel_room_allocation_rule_items
       where allocated_guest_counts is not null or pricing_guest_counts is not null)
     or exists(select 1 from public.hotel_calendar_overrides where
       pricing_source is not null or pricing_reason is not null
       or pricing_expires_at is not null or pricing_actor_type is not null
       or pricing_actor_id is not null or pricing_updated_at is not null
       or pricing_correlation_id is not null) then
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: migration seeded or rewrote pricing rows';
  end if;

  if (select count(*) from public.site_settings)<>1
     or not exists(select 1 from public.site_settings where id=1
       and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
       and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled) then
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: flags changed';
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
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: public.hotels structural RLS drift';
  end if;

  v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  if not coalesce((v_snapshot->>'supported')::boolean,false)
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact()
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
     or exists(select 1 from public.hotel_rate_plans where hotel_id=c_hotel and is_active)
     or exists(select 1 from public.hotel_room_rates where hotel_id=c_hotel and is_active)
     or exists(select 1 from public.hotel_pricing_schedules where hotel_id=c_hotel and is_active)
     or exists(select 1 from public.hotel_property_pricing_defaults where hotel_id=c_hotel) then
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: accepted H3.1P graph changed';
  end if;

  -- ADMIN-C deliberately generalizes only the two historical H3.1
  -- "at least two Rooms/units" assumptions. Pin the installed successor so
  -- this standalone foundation verifier also proves the generic one-Room
  -- contract instead of relying on an integration fixture alone.
  select pg_get_functiondef(
    'public.hotel_v2_h3_1_validate_allocation_rule(uuid)'::regprocedure
  ) into v_definition;
  if strpos(v_definition,
       '(v_rule.allocation_mode=''customer_choice'' and v_count<1)')=0
     or strpos(v_definition,
       'v_units<1 or v_total<>v_rule.min_guest_count')=0
     or strpos(v_definition,
       '(v_rule.allocation_mode=''customer_choice'' and v_count<2)')>0
     or strpos(v_definition,
       'v_units<2 or v_total<>v_rule.min_guest_count')>0 then
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: generalized allocation validator drift';
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
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: raw pricing ACL exposed';
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
    if not has_function_privilege('authenticated',v_signature,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE')
       or not (select proowner='postgres'::regrole and prosecdef
         from pg_proc where oid=to_regprocedure(v_signature))
       or (select proconfig from pg_proc where oid=to_regprocedure(v_signature))
         is distinct from array['search_path=pg_catalog, public, auth']::text[]
       or exists(select 1 from pg_proc procedure_row
         cross join lateral aclexplode(coalesce(procedure_row.proacl,
           acldefault('f',procedure_row.proowner))) privilege_row
         where procedure_row.oid=to_regprocedure(v_signature)
           and privilege_row.grantee=0 and privilege_row.privilege_type='EXECUTE') then
      raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: public RPC ACL mismatch: %',v_signature;
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
       cross join lateral aclexplode(coalesce(procedure_row.proacl,
         acldefault('f',procedure_row.proowner))) privilege_row
       where procedure_row.oid=to_regprocedure(
         'public.hotel_v2_admin_c_guest_array_matches_total(smallint[],integer,smallint)')
         and privilege_row.grantee=0 and privilege_row.privilege_type='EXECUTE')
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
           or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))) then
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: internal helper ACL mismatch';
  end if;

  if not (select relrowsecurity from pg_class where oid=
       'public.hotel_property_pricing_defaults'::regclass)
     or not (select relrowsecurity from pg_class where oid=
       'public.hotel_admin_pricing_action_receipts'::regclass)
     or exists(select 1 from pg_policies where schemaname='public'
       and tablename in('hotel_property_pricing_defaults',
         'hotel_admin_pricing_action_receipts'))
     or not exists(select 1 from pg_trigger where tgrelid=
       'public.hotel_admin_pricing_action_receipts'::regclass
       and tgname='hotel_admin_pricing_action_receipts_immutable' and not tgisinternal)
     or not exists(select 1 from pg_trigger where tgrelid=
       'public.hotel_calendar_overrides'::regclass
       and tgname='hotel_calendar_overrides_admin_c_pricing_provenance_guard'
       and not tgisinternal)
     or not exists(select 1 from pg_trigger where tgrelid=
       'public.hotels'::regclass and tgname='hotels_admin_c_pricing_dependency_guard'
       and not tgisinternal) then
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: RLS/invariant trigger mismatch';
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
    raise exception 'HOTELS_V2_ADMIN_C_VERIFY_FAIL: protected commercial/history drift';
  end if;
end
$admin_c_verify$;

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
  true as hotels_v2_admin_c_pricing_control_foundation_safe
from protected_relations cross join oracle;
