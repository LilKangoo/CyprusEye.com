-- Hotels V2 ADMIN-B post-Admin verification.
-- READ ONLY. Supabase SQL Editor compatible (no psql meta-commands).
-- Run after reviewed ADMIN-B property/Room/assignment saves. Property content,
-- Room content and the future-routing operational assignment are allowed to
-- differ from preflight; protected commercial/history relations are not.

do $admin_b_post_admin_verify$
declare
  c_hotel constant uuid := '9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  v_snapshot jsonb;
begin
  if to_regclass('public.hotel_property_operational_profiles') is null
     or to_regclass('public.hotel_admin_assignment_transaction_context') is null
     or to_regprocedure('public.hotel_v2_admin_get_content_control(uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_room_control_plan(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_operational_assignment_plan(jsonb,uuid)') is null then
    raise exception 'HOTELS_V2_ADMIN_B_POST_ADMIN_FAIL: ADMIN-B foundation missing';
  end if;

  if exists (select 1 from public.hotel_admin_assignment_transaction_context)
     or exists (
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
    raise exception 'HOTELS_V2_ADMIN_B_POST_ADMIN_FAIL: assignment context/scope invariant failed';
  end if;

  if exists (
       select 1
       from public.hotel_property_operational_profiles profile
       join public.hotels hotel on hotel.id = profile.hotel_id
       where profile.maximum_stay_nights is not null
         and hotel.minimum_stay_nights is not null
         and profile.maximum_stay_nights < hotel.minimum_stay_nights
     )
     or exists (
       select 1 from public.hotel_property_operational_profiles profile
       where not public.hotel_v2_admin_b_i18n_is_valid(
           profile.guest_instructions_i18n, false, 8000)
          or not public.hotel_v2_admin_b_i18n_is_valid(
           profile.check_in_instructions_i18n, false, 8000)
          or not public.hotel_v2_admin_b_i18n_is_valid(
           profile.check_out_instructions_i18n, false, 8000)
          or length(coalesce(profile.internal_operational_notes, '')) > 5000
     ) then
    raise exception 'HOTELS_V2_ADMIN_B_POST_ADMIN_FAIL: operational profile invariant failed';
  end if;

  -- Private instructions and notes must never become columns of the legacy
  -- public-readable Hotel relation.
  if exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'hotels'
         and column_name in (
           'guest_instructions_i18n','check_in_instructions_i18n',
           'check_out_instructions_i18n','internal_operational_notes'
         )
     ) then
    raise exception 'HOTELS_V2_ADMIN_B_POST_ADMIN_FAIL: private content leaked into public.hotels schema';
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
         and md5(pricing_tiers::text) = '7208ab4ecc0e47abd64d87ca1ac53a03'
         and jsonb_array_length(pricing_tiers -> 'rules') = 63
     )
     or exists (select 1 from public.hotel_rate_plans where hotel_id = c_hotel and is_active)
     or exists (select 1 from public.hotel_room_rates where hotel_id = c_hotel and is_active) then
    raise exception 'HOTELS_V2_ADMIN_B_POST_ADMIN_FAIL: public activation/legacy pricing guard failed';
  end if;

  v_snapshot := public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  if not coalesce((v_snapshot ->> 'supported')::boolean, false)
     or v_snapshot #>> '{promotion,status}' <> 'reviewed'
     or v_snapshot #>> '{source,pricing_fingerprint}' <> '7208ab4ecc0e47abd64d87ca1ac53a03'
     or v_snapshot #>> '{target,target_fingerprint}' <> 'baeaae09e1775f28f39695696084f5a1'
     or v_snapshot ->> 'pricing_occupancy_mapping_fingerprint'
          <> '6f6e6c64f0b0d0aa60e3575d4fd4ac1c'
     or v_snapshot #>> '{parity,fingerprint}' <> 'b3c915266ab060efaba522cf5587fb75'
     or (v_snapshot #>> '{parity,total_case_count}')::integer <> 70
     or (v_snapshot #>> '{parity,total_mismatch_count}')::integer <> 0
     or (v_snapshot #>> '{target,room_schedule,tier_count}')::integer <> 27
     or (v_snapshot #>> '{source,property_party_preview,tier_count}')::integer <> 63
     or (v_snapshot #>> '{target,rate_plan,is_active}')::boolean
     or exists (
       select 1 from jsonb_array_elements(v_snapshot #> '{target,room_rates}') rate
       where (rate ->> 'is_active')::boolean
     ) then
    raise exception 'HOTELS_V2_ADMIN_B_POST_ADMIN_FAIL: H3.1P pricing contract drift';
  end if;

  if (select count(*) from public.hotel_bookings) <> 3
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|'
          order by row_value.id), '')) from public.hotel_bookings row_value)
          <> 'fb5a4c508b0df32afbffe5b1594c7a50'
     or (select count(*) from public.partner_service_fulfillments
          where resource_type = 'hotels') <> 5
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|'
          order by row_value.id), '')) from public.partner_service_fulfillments row_value
          where resource_type = 'hotels') <> '1e01541853d87d26adccb8172074934b'
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|'
          order by row_value.id), '')) from public.service_deposit_requests row_value
          where resource_type = 'hotels') <> '42b5e1dc9726890e90014c3e89c2329d'
     or (select md5(coalesce(string_agg(to_jsonb(row_value)::text, '|'
          order by row_value.id), '')) from public.service_coupon_redemptions row_value
          where service_type = 'hotels') <> 'd41d8cd98f00b204e9800998ecf8427e' then
    raise exception 'HOTELS_V2_ADMIN_B_POST_ADMIN_FAIL: protected booking/commercial history drift';
  end if;
end
$admin_b_post_admin_verify$;

-- Compare protected_history_fingerprints to the accepted preflight output.
-- Assignment/content/Room/activity relations are reported separately because
-- reviewed ADMIN-B actions are expected to change them.
with protected_history as (
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
      'hotel_partner_action_receipts','hotel_partner_event_outbox',
      'partners','partner_users',
      'referrals','affiliate_commission_events','affiliate_payouts',
      'affiliate_adjustments','affiliate_program_settings',
      'affiliate_referrer_overrides','affiliate_cashout_requests',
      'profile_referral_code_aliases','site_settings'
    )
), mutable_admin_state as (
  select jsonb_build_object(
    'hotels', md5(pg_catalog.query_to_xml(
      'select to_jsonb(row_value)::text from public.hotels row_value order by row_value.id',
      true, true, '')::text),
    'room_types', md5(pg_catalog.query_to_xml(
      'select to_jsonb(row_value)::text from public.hotel_room_types row_value order by row_value.id',
      true, true, '')::text),
    'assignments', md5(pg_catalog.query_to_xml(
      $$select to_jsonb(row_value)::text from public.partner_resources row_value
        where resource_type='hotels' order by row_value.id$$,
      true, true, '')::text),
    'staff_scopes', md5(pg_catalog.query_to_xml(
      $$select to_jsonb(row_value)::text from public.partner_user_resources row_value
        where resource_type='hotels' order by row_value.id$$,
      true, true, '')::text),
    'permissions', md5(pg_catalog.query_to_xml(
      'select to_jsonb(row_value)::text from public.hotel_partner_hotel_permissions row_value order by row_value.assignment_id',
      true, true, '')::text),
    'operational_profiles', md5(pg_catalog.query_to_xml(
      'select to_jsonb(row_value)::text from public.hotel_property_operational_profiles row_value order by row_value.hotel_id',
      true, true, '')::text),
    'activity', md5(pg_catalog.query_to_xml(
      $$select to_jsonb(row_value)::text from public.hotel_activity_log row_value
        order by row_value.id$$,
      true, true, '')::text)
  ) fingerprints
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
    case when (select count(*) from public.hotel_bookings)=3
      and (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
        order by row_value.id),'')) from public.hotel_bookings row_value)
        ='fb5a4c508b0df32afbffe5b1594c7a50'
      and (select count(*) from public.partner_service_fulfillments
        where resource_type='hotels')=5
      and (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
        order by row_value.id),'')) from public.partner_service_fulfillments row_value
        where resource_type='hotels')='1e01541853d87d26adccb8172074934b'
      and (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
        order by row_value.id),'')) from public.service_deposit_requests row_value
        where resource_type='hotels')='42b5e1dc9726890e90014c3e89c2329d'
      and (select md5(coalesce(string_agg(to_jsonb(row_value)::text,'|'
        order by row_value.id),'')) from public.service_coupon_redemptions row_value
        where service_type='hotels')='d41d8cd98f00b204e9800998ecf8427e'
      then 0 else 1 end hotel_booking_payload_unexplained_difference
  from legacy_replay replay cross join pricing_snapshot snapshot
)
select
  protected_history.fingerprints protected_history_fingerprints,
  mutable_admin_state.fingerprints reviewed_admin_state_fingerprints,
  oracle.hotel_7_arches_occupancy_price_mismatch
    as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  oracle.hotel_legacy_price_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  oracle.hotel_legacy_public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  oracle.hotel_booking_payload_unexplained_difference
    as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  true as hotels_v2_admin_b_content_room_assignment_post_admin_safe
from protected_history cross join mutable_admin_state cross join oracle;
