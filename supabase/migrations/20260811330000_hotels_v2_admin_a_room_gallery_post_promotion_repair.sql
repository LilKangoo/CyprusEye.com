begin;
set transaction isolation level repeatable read;

-- ADMIN-A repairs the reviewed 7 Kamares Room Type gallery save after H3.1P.
-- It changes one Admin RPC only.  No Hotel, price, booking, fulfillment,
-- payment, referral, permission or feature-flag row is written here.
lock table public.site_settings in share mode;

create temporary table hotels_v2_admin_a_protected_snapshot(
  relation_name text primary key,
  row_count bigint not null,
  fingerprint text not null
) on commit drop;

do $capture_protected_relations$
declare
  v_relation text;
begin
  foreach v_relation in array array[
    'hotels','hotel_bookings','partner_service_fulfillments','site_settings',
    'service_deposit_requests','service_deposit_rules','service_deposit_overrides',
    'service_coupons','service_coupon_redemptions',
    'hotel_room_types','hotel_units','hotel_rate_plans','hotel_room_rates',
    'hotel_rate_rules','hotel_daily_inventory','hotel_daily_rates',
    'hotel_room_rate_occupancy_tiers','hotel_calendar_overrides',
    'hotel_pricing_schedules','hotel_pricing_schedule_occupancy_tiers',
    'hotel_room_allocation_rules','hotel_room_allocation_rule_items',
    'hotel_payment_policies','hotel_payment_policy_terms','hotel_commission_policies',
    'hotel_calendar_source_configs','hotel_pricing_promotion_reviews',
    'hotel_partner_hotel_permissions','hotel_partner_action_receipts',
    'hotel_partner_event_outbox','hotel_activity_log',
    'referrals','affiliate_commission_events','affiliate_payouts',
    'affiliate_adjustments','affiliate_program_settings',
    'affiliate_referrer_overrides','affiliate_cashout_requests',
    'profile_referral_code_aliases'
  ] loop
    if to_regclass('public.' || v_relation) is not null then
      execute format(
        'insert into hotels_v2_admin_a_protected_snapshot '
        ||'select %L,count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' '
        ||'order by to_jsonb(row_value)::text),'''')) from public.%I row_value',
        v_relation,v_relation
      );
    end if;
  end loop;
end
$capture_protected_relations$;

create temporary table hotels_v2_admin_a_hotels_rls_snapshot on commit drop as
select
  coalesce((select relrowsecurity from pg_catalog.pg_class
    where oid='public.hotels'::regclass),false) rls_enabled,
  md5(coalesce(string_agg(jsonb_build_object(
    'policyname',policyname,'permissive',permissive,'roles',roles,
    'cmd',cmd,'qual',qual,'with_check',with_check
  )::text,'|' order by policyname),'')) fingerprint
from pg_catalog.pg_policies
where schemaname='public' and tablename='hotels';

do $install_admin_a_repair$
declare
  c_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
  c_schedule constant uuid:='b0a3104f-7b31-5265-a59f-c2d166f11a23';
  c_contract constant text:='seven_kamares_legacy_to_h3_pricing_v1';
  v_definition text;
  v_original_definition text;
  v_old text;
  v_new text;
  v_snapshot jsonb;
begin
  if to_regprocedure('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)') is null
     or to_regprocedure('public.hotel_v2_h3_1p_pricing_promotion_snapshot(uuid)') is null
     or to_regclass('public.hotel_pricing_promotion_reviews') is null
     or to_regclass('public.hotel_room_types') is null
     or to_regclass('public.hotel_activity_log') is null then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_prerequisite_missing';
  end if;

  if (select count(*) from public.site_settings where id=1
      and not hotel_rooms_v2_enabled and not hotel_external_sync_enabled
      and not hotel_instant_booking_enabled and not hotel_stripe_connect_enabled)<>1
     or not exists(select 1 from public.hotels where id=c_hotel
       and architecture_version='legacy') then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_public_inert_guard_failed';
  end if;

  -- Stabilize the reviewed commercial graph while validating and replacing
  -- the function.  No row is changed by these locks.
  perform 1 from public.hotels where id=c_hotel for share;
  perform 1 from public.hotel_room_types where hotel_id=c_hotel order by id for share;
  perform 1 from public.hotel_rate_plans where hotel_id=c_hotel order by id for share;
  perform 1 from public.hotel_room_rates where hotel_id=c_hotel order by id for share;
  perform 1 from public.hotel_pricing_schedules where hotel_id=c_hotel order by id for share;
  perform 1 from public.hotel_pricing_schedule_occupancy_tiers
    where schedule_id in(
      c_schedule,'443065c0-984a-5de3-a22a-d03042c41107'::uuid
    ) order by id for share;
  perform 1 from public.hotel_room_allocation_rules
    where hotel_id=c_hotel order by id for share;
  perform 1 from public.hotel_room_allocation_rule_items
    where hotel_id=c_hotel order by id for share;
  perform 1 from public.hotel_pricing_promotion_reviews
    where hotel_id=c_hotel and contract_version=c_contract for share;

  v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  if not coalesce((v_snapshot->>'supported')::boolean,false)
     or v_snapshot->>'contract_version'<>c_contract
     or v_snapshot#>>'{promotion,status}'<>'reviewed'
     or v_snapshot#>>'{target,room_schedule,id}'<>c_schedule::text
     or v_snapshot#>>'{target,room_schedule,review_status}'<>'reviewed'
     or coalesce((v_snapshot#>>'{target,room_schedule,is_active}')::boolean,true)
     or (v_snapshot#>>'{parity,total_case_count}')::integer<>70
     or (v_snapshot#>>'{parity,total_mismatch_count}')::integer<>0
     or not coalesce((v_snapshot#>>'{safety,legacy_authoritative}')::boolean,false)
     or not coalesce((v_snapshot#>>'{safety,architecture_legacy}')::boolean,false)
     or not coalesce((v_snapshot#>>'{safety,room_schedule_inactive}')::boolean,false)
     or not coalesce((v_snapshot#>>'{safety,rate_plan_inactive}')::boolean,false)
     or not coalesce((v_snapshot#>>'{safety,room_rates_inactive}')::boolean,false)
     or not coalesce((v_snapshot#>>'{safety,all_flags_off}')::boolean,false)
     or not exists(
       select 1 from public.hotel_pricing_promotion_reviews review
       where review.hotel_id=c_hotel and review.contract_version=c_contract
         and review.source_fingerprint=v_snapshot#>>'{source,pricing_fingerprint}'
         and review.source_tier_fingerprint=v_snapshot#>>'{source,tier_fingerprint}'
         and review.target_fingerprint=v_snapshot#>>'{target,target_fingerprint}'
         and review.pricing_occupancy_mapping_fingerprint=
           v_snapshot->>'pricing_occupancy_mapping_fingerprint'
         and review.parity_fingerprint=v_snapshot#>>'{parity,fingerprint}'
         and review.parity_case_count=70 and review.parity_mismatch_count=0
         and review.acknowledged_pricing_occupancy_mapping
         and review.review_status='reviewed'
     ) then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_promotion_contract_drift';
  end if;

  select pg_get_functiondef(
    'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure
  ) into v_definition;
  v_original_definition:=v_definition;

  -- Manual reapplication of the exact repair is intentionally a no-op.
  if v_definition like '%hotels_v2_admin_a_reviewed_schedule_v1%'
     and v_definition like '%hotels_v2_admin_a_noop_room_upsert_v1%'
     and v_definition like '%hotels_v2_admin_a_field_scoped_room_version_v1%' then
    return;
  end if;

  -- Fail closed rather than rewriting an unknown function body.
  if v_definition not like '%hotels_v2_h2b2_preserve_reviewed_property_policy_v1%'
     or v_definition not like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
     or v_definition not like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
     or v_definition not like '%hotels_v2_h2b1_three_way_identity_v1%'
     or v_definition not like '%legacy_source_key=excluded.legacy_source_key%'
     or v_definition not like '%perform public.hotel_v2_h2a_require_admin()%'
     or v_definition not like '%review_status from public.hotel_pricing_schedules where id=c_schedule)<>''requires_review''%'
     or v_definition not like '%or v_room.version<>v_existing_version then%'
     or v_definition like '%hotels_v2_admin_a_%' then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_function_drift';
  end if;

  v_old:='v_expected_original jsonb; v_current_state jsonb; v_target_state jsonb; v_state_key text;';
  v_new:='v_expected_original jsonb; v_current_state jsonb; v_target_state jsonb; v_state_key text;
  v_promotion_snapshot jsonb;';
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_declaration_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old:=$old$begin
  perform public.hotel_v2_h2a_require_admin();$old$;
  v_new:=$new$begin
  perform public.hotel_v2_h2a_require_admin();
  -- Lock-order parity with H3.1P: flags precede Hotel/Room/commercial rows.
  perform 1 from public.site_settings where id=1 for share;$new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_site_lock_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  -- Identity stays non-mergeable.  A changed version is evaluated only after
  -- field comparison so a true gallery collision returns its exact field
  -- detail.  The final version guard remains mandatory for version-only or
  -- unowned-field changes.
  v_old:=$old$         or (v_room.legacy_source_key is not null
           and v_room.legacy_source_key<>v_room_json->>'source_key')
         or v_room.version<>v_existing_version then$old$;
  v_new:=$new$         or (v_room.legacy_source_key is not null
           and v_room.legacy_source_key<>v_room_json->>'source_key') then
        -- hotels_v2_admin_a_field_scoped_room_version_v1$new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_identity_guard_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old:=$old$        end loop;
      end if;
    elsif v_expected_original is not null or v_existing_version<>0$old$;
  v_new:=$new$        end loop;
      end if;
      -- A detailed owned-field conflict wins over the generic stale error,
      -- but an unexpected version never receives a blind overwrite.
      if v_room.version<>v_existing_version then
        raise exception using errcode='PT409',message='hotels_v2_h2b1_stale_shadow_room';
      end if;
    elsif v_expected_original is not null or v_existing_version<>0$new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_version_guard_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  -- H2B.1's pre-promotion requires_review state remains valid.  The reviewed
  -- state is accepted only when the immutable H3.1P receipt, current mapping,
  -- parity oracle, inactive pricing graph, legacy architecture and OFF flags
  -- all still match the exact reviewed snapshot.
  v_old:=$old$  perform 1 from public.hotel_pricing_schedules where id=c_schedule for update;$old$;
  v_new:=$new$  -- hotels_v2_admin_a_reviewed_schedule_v1
  v_promotion_snapshot:=null;
  -- The site/Hotel/Room locks are already held in H3.1P order.  Continue with
  -- plan/rates/schedules before reading review_status or its receipt.
  perform 1 from public.hotel_rate_plans where id=c_plan for update;
  perform 1 from public.hotel_room_rates
    where id in(c_upper_rate,c_ground_rate) order by id for update;
  perform 1 from public.hotel_pricing_schedules
    where id in(c_schedule,c_party_preview) order by id for update;
  if (select review_status from public.hotel_pricing_schedules where id=c_schedule)='reviewed' then
    -- Lock every row consumed by the H3.1P snapshot before computing it.
    -- Later exact predicates revalidate the same locked graph before writes.
    perform 1 from public.hotel_pricing_schedule_occupancy_tiers
      where schedule_id in(c_schedule,c_party_preview) order by id for share;
    perform 1 from public.hotel_room_allocation_rules
      where hotel_id=c_hotel order by id for share;
    perform 1 from public.hotel_room_allocation_rule_items
      where hotel_id=c_hotel order by id for share;
    perform 1 from public.hotel_pricing_promotion_reviews
      where hotel_id=c_hotel
        and contract_version='seven_kamares_legacy_to_h3_pricing_v1' for share;
    v_promotion_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(c_hotel);
  end if;
  perform 1 from public.hotel_pricing_schedules where id=c_schedule for update;
  $new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_schedule_lock_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old:=$old$       or (select review_status from public.hotel_pricing_schedules where id=c_schedule)<>'requires_review'$old$;
  v_new:=$new$       or (select review_status from public.hotel_pricing_schedules where id=c_schedule)
          not in('requires_review','reviewed')
       or (
         (select review_status from public.hotel_pricing_schedules where id=c_schedule)='reviewed'
         and (
           v_promotion_snapshot->>'contract_version'<>'seven_kamares_legacy_to_h3_pricing_v1'
           or v_promotion_snapshot#>>'{promotion,status}'<>'reviewed'
           or v_promotion_snapshot#>>'{source,pricing_fingerprint}'<>v_price_fingerprint
           or v_promotion_snapshot#>>'{target,room_schedule,id}'<>c_schedule::text
           or v_promotion_snapshot#>>'{target,room_schedule,review_status}'<>'reviewed'
           or coalesce((v_promotion_snapshot#>>'{target,room_schedule,is_active}')::boolean,true)
           or (v_promotion_snapshot#>>'{target,room_schedule,tier_count}')::integer<>27
           or (v_promotion_snapshot#>>'{parity,total_case_count}')::integer<>70
           or (v_promotion_snapshot#>>'{parity,total_mismatch_count}')::integer<>0
           or coalesce(
             v_promotion_snapshot->'blockers',
             '["allocation_pricing_occupancy_contract_mismatch"]'::jsonb
           ) @> '["allocation_pricing_occupancy_contract_mismatch"]'::jsonb
           or not coalesce((v_promotion_snapshot#>>'{safety,room_schedule_inactive}')::boolean,false)
           or not coalesce((v_promotion_snapshot#>>'{safety,rate_plan_inactive}')::boolean,false)
           or not coalesce((v_promotion_snapshot#>>'{safety,room_rates_inactive}')::boolean,false)
           or not coalesce((v_promotion_snapshot#>>'{safety,all_flags_off}')::boolean,false)
           or not exists(
             select 1 from public.hotel_pricing_promotion_reviews review
             where review.hotel_id=c_hotel
               and review.contract_version='seven_kamares_legacy_to_h3_pricing_v1'
               and review.source_fingerprint=
                 v_promotion_snapshot#>>'{source,pricing_fingerprint}'
               and review.source_tier_fingerprint=
                 v_promotion_snapshot#>>'{source,tier_fingerprint}'
               and review.pricing_occupancy_mapping_fingerprint=
                 v_promotion_snapshot->>'pricing_occupancy_mapping_fingerprint'
               and review.parity_fingerprint=v_promotion_snapshot#>>'{parity,fingerprint}'
               and review.parity_case_count=70 and review.parity_mismatch_count=0
               and review.acknowledged_pricing_occupancy_mapping
               and review.review_status='reviewed'
               and review.result->>'ok'='true'
               and review.result->>'public_change'='false'
               and review.result->>'legacy_authoritative'='true'
               and review.result->>'source_fingerprint'=review.source_fingerprint
               and review.result->>'target_fingerprint'=review.target_fingerprint
               and review.result->>'pricing_occupancy_mapping_fingerprint'=
                 review.pricing_occupancy_mapping_fingerprint
               and review.result#>>'{parity,fingerprint}'=review.parity_fingerprint
               and (review.result#>>'{parity,total_case_count}')::integer=70
               and (review.result#>>'{parity,total_mismatch_count}')::integer=0
               and review.result#>>'{room_schedule,id}'=c_schedule::text
               and review.result#>>'{room_schedule,review_status}'='reviewed'
               and review.result#>>'{room_schedule,is_active}'='false'
               and review.result#>>'{room_schedule,code}'=
                 v_promotion_snapshot#>>'{target,room_schedule,code}'
               and review.result#>>'{room_schedule,application_scope}'=
                 v_promotion_snapshot#>>'{target,room_schedule,application_scope}'
               and review.result#>>'{room_schedule,currency}'=
                 v_promotion_snapshot#>>'{target,room_schedule,currency}'
               and review.result#>>'{room_schedule,maximum_party_size}'=
                 v_promotion_snapshot#>>'{target,room_schedule,maximum_party_size}'
               and review.result#>>'{room_schedule,minimum_billable_occupancy}'=
                 v_promotion_snapshot#>>'{target,room_schedule,minimum_billable_occupancy}'
               and review.result#>>'{room_schedule,tier_count}'=
                 v_promotion_snapshot#>>'{target,room_schedule,tier_count}'
               and review.result#>>'{room_schedule,tier_fingerprint}'=
                 v_promotion_snapshot#>>'{target,room_schedule,tier_fingerprint}'
           )
         )
       )$new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_schedule_predicate_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  -- PostgreSQL's generic version trigger runs for every UPDATE, even when all
  -- assigned values are identical.  Suppress that UPDATE and its activity row
  -- unless at least one field owned by this preparation actually changes.
  v_old:=$old$  for v_room_json in select value from jsonb_array_elements(p_plan->'rooms') loop
    select to_jsonb(room_type) into v_before from public.hotel_room_types room_type where id=(v_room_json->>'id')::uuid;
    insert into public.hotel_room_types($old$;
  v_new:=$new$  for v_room_json in select value from jsonb_array_elements(p_plan->'rooms') loop
    select to_jsonb(room_type) into v_before from public.hotel_room_types room_type where id=(v_room_json->>'id')::uuid;
    v_after:=null;
    insert into public.hotel_room_types($new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_upsert_initialization_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  v_old:=$old$      legacy_source_key=excluded.legacy_source_key
    returning to_jsonb(hotel_room_types.*) into v_after;
    insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
    values(c_hotel,'room_type',(v_room_json->>'id')::uuid,case when v_before is null then 'create' else 'update' end,
      v_before,v_after,'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);$old$;
  v_new:=$new$      legacy_source_key=excluded.legacy_source_key
    -- hotels_v2_admin_a_noop_room_upsert_v1
    where row(
      hotel_room_types.code,hotel_room_types.name_i18n,hotel_room_types.description_i18n,
      hotel_room_types.gallery,hotel_room_types.capacity_adults,hotel_room_types.capacity_children,
      hotel_room_types.max_occupancy,hotel_room_types.amenities,
      hotel_room_types.inventory_mode,hotel_room_types.base_inventory_count,
      hotel_room_types.sort_order,hotel_room_types.legacy_source_key
    ) is distinct from row(
      excluded.code,excluded.name_i18n,excluded.description_i18n,
      excluded.gallery,excluded.capacity_adults,excluded.capacity_children,
      excluded.max_occupancy,excluded.amenities,
      excluded.inventory_mode,excluded.base_inventory_count,
      excluded.sort_order,excluded.legacy_source_key
    )
    returning to_jsonb(hotel_room_types.*) into v_after;
    if v_after is not null then
      insert into public.hotel_activity_log(hotel_id,entity_type,entity_id,action,before_state,after_state,actor_type,actor_id,source,correlation_id)
      values(c_hotel,'room_type',(v_room_json->>'id')::uuid,case when v_before is null then 'create' else 'update' end,
        v_before,v_after,'admin',auth.uid(),'hotels_v2_h2b1_shadow_prepare',p_correlation_id);
    end if;$new$;
  if strpos(v_definition,v_old)=0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_upsert_drift';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);

  if v_definition=v_original_definition
     or v_definition not like '%hotels_v2_admin_a_reviewed_schedule_v1%'
     or v_definition not like '%hotels_v2_admin_a_noop_room_upsert_v1%'
     or v_definition not like '%hotels_v2_admin_a_field_scoped_room_version_v1%'
     or v_definition not like '%v_promotion_snapshot%'
     or v_definition not like '%review.result#>>''{room_schedule,review_status}''=''reviewed''%'
     or v_definition not like '%where row(%'
     or v_definition not like '%if v_after is not null then%'
     or (length(v_definition)-length(replace(v_definition,
       'returning to_jsonb(hotel_room_types.*) into v_after;','')))
       / length('returning to_jsonb(hotel_room_types.*) into v_after;')<>1
     or v_definition like '%or v_room.version<>v_existing_version then%'
     or v_definition like '%review_status from public.hotel_pricing_schedules where id=c_schedule)<>''requires_review''%' then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_rewrite_failed';
  end if;

  execute v_definition;
end
$install_admin_a_repair$;

comment on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid) is
  'Admin-only exact 7 Kamares room/photo preparation. A reviewed inactive H3.1P schedule requires its exact immutable promotion receipt and live parity contract. Room writes and activity are no-op-safe; detailed three-way conflicts precede, but never bypass, exact version protection.';

revoke all on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)
  to authenticated;

do $admin_a_postconditions$
declare
  v_row hotels_v2_admin_a_protected_snapshot%rowtype;
  v_count bigint;
  v_fingerprint text;
  v_definition text;
  v_snapshot jsonb;
  v_rls_enabled boolean;
  v_rls_fingerprint text;
begin
  for v_row in select * from hotels_v2_admin_a_protected_snapshot loop
    execute format(
      'select count(*),md5(coalesce(string_agg(to_jsonb(row_value)::text,''|'' '
      ||'order by to_jsonb(row_value)::text),'''')) from public.%I row_value',
      v_row.relation_name
    ) into v_count,v_fingerprint;
    if v_count<>v_row.row_count or v_fingerprint is distinct from v_row.fingerprint then
      raise exception using errcode='55000',
        message='hotels_v2_admin_a_gallery_repair_changed_protected_data',
        detail=v_row.relation_name;
    end if;
  end loop;

  select
    coalesce((select relrowsecurity from pg_catalog.pg_class
      where oid='public.hotels'::regclass),false),
    md5(coalesce(string_agg(jsonb_build_object(
      'policyname',policyname,'permissive',permissive,'roles',roles,
      'cmd',cmd,'qual',qual,'with_check',with_check
    )::text,'|' order by policyname),''))
  into v_rls_enabled,v_rls_fingerprint
  from pg_catalog.pg_policies
  where schemaname='public' and tablename='hotels';
  if (select rls_enabled from hotels_v2_admin_a_hotels_rls_snapshot)
       is distinct from v_rls_enabled
     or (select fingerprint from hotels_v2_admin_a_hotels_rls_snapshot)
       is distinct from v_rls_fingerprint then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_changed_hotels_rls';
  end if;

  select pg_get_functiondef(
    'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure
  ) into v_definition;
  v_snapshot:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca');

  if v_definition not like '%hotels_v2_admin_a_reviewed_schedule_v1%'
     or v_definition not like '%hotels_v2_admin_a_noop_room_upsert_v1%'
     or v_definition not like '%hotels_v2_admin_a_field_scoped_room_version_v1%'
     or v_definition not like '%hotels_v2_h2b2_preserve_reviewed_property_policy_v1%'
     or v_definition not like '%hotels_v2_h2b1_preserve_reviewed_rate_plan_v1%'
     or v_definition not like '%hotels_v2_h2b1_shadow_room_three_way_conflict%'
     or (length(v_definition)-length(replace(v_definition,
       'returning to_jsonb(hotel_room_types.*) into v_after;','')))
       / length('returning to_jsonb(hotel_room_types.*) into v_after;')<>1
     or v_definition like '%or v_room.version<>v_existing_version then%'
     or not (select prosecdef from pg_catalog.pg_proc
       where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)
     or (select proowner::regrole::text from pg_catalog.pg_proc
       where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)<>'postgres'
     or not coalesce((select proconfig @> array['search_path=pg_catalog, public, auth']
       from pg_catalog.pg_proc
       where oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure),false)
     or has_function_privilege(0::oid,
       'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure,'EXECUTE')
     or has_function_privilege('anon',
       'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or has_function_privilege('service_role',
       'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or not has_function_privilege('authenticated',
       'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)','EXECUTE')
     or not coalesce((v_snapshot->>'supported')::boolean,false)
     or v_snapshot#>>'{promotion,status}'<>'reviewed'
     or v_snapshot#>>'{target,room_schedule,review_status}'<>'reviewed'
     or coalesce((v_snapshot#>>'{target,room_schedule,is_active}')::boolean,true)
     or (v_snapshot#>>'{parity,total_case_count}')::integer<>70
     or (v_snapshot#>>'{parity,total_mismatch_count}')::integer<>0 then
    raise exception using errcode='55000',
      message='hotels_v2_admin_a_gallery_repair_postcondition_failed';
  end if;
end
$admin_a_postconditions$;

notify pgrst,'reload schema';
commit;
