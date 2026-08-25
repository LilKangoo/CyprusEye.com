-- H3.2B post-Partner verification (READ ONLY, standalone SQL Editor compatible).
-- Legitimate reviewed Partner content/pricing/inventory deltas are permitted;
-- protected A/B/C/D/H3.1P/booking/payment/commission history is byte-bound.

with protected as(
  select exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
    where receipt.id=1
      and receipt.protected_fingerprint=public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints)) value
), ledger as(
  select not exists(
    select 1 from public.hotel_partner_action_receipts receipt
    left join public.hotel_partner_workspace_plan_reviews review
      on review.consumed_correlation_id=receipt.correlation_id
      and review.actor_id=receipt.actor_user_id
    where receipt.action in('h3_2b_content','h3_2b_pricing','h3_2b_availability') and (
      review.id is null or review.consumed_at is null
      or review.partner_id<>receipt.partner_id or review.hotel_id<>receipt.hotel_id
      or receipt.action<>'h3_2b_'||review.domain
      or receipt.request_hash<>review.plan_fingerprint
      or receipt.result->>'contract_version'<>'hotels_v2_h3_2b_'||review.domain||'_apply_result_v1'
      or receipt.result->>'partner_id' is distinct from receipt.partner_id::text
      or receipt.result->>'hotel_id' is distinct from receipt.hotel_id::text
      or receipt.result->>'correlation_id' is distinct from receipt.correlation_id::text
      or receipt.result->>'idempotency_key' is distinct from receipt.idempotency_key::text
      or receipt.result->'workspace' is distinct from 'null'::jsonb
      or jsonb_typeof(receipt.result->'activity')<>'array'
      or jsonb_array_length(receipt.result->'activity')<>1
      or exists(select 1 from jsonb_array_elements(receipt.result->'activity') item(value)
        left join public.hotel_activity_log activity on activity.id=(item.value->>'id')::uuid
        where activity.id is null or activity.hotel_id<>receipt.hotel_id
          or activity.actor_id<>receipt.actor_user_id or activity.actor_type<>'partner'
          or activity.source<>'hotels_v2_h3_2b_partner_workspace'
          or activity.correlation_id<>receipt.correlation_id
          or item.value is distinct from jsonb_build_object('id',activity.id,'hotel_id',activity.hotel_id,
            'entity_type',activity.entity_type,'entity_id',activity.entity_id,'action',activity.action,
            'actor_type','partner','source','hotels_v2_h3_2b_partner_workspace',
            'correlation_id',activity.correlation_id,'created_at',activity.created_at))
      or not exists(select 1 from jsonb_array_elements(review.reviewed_plan->'operations') operation(value),
          jsonb_array_elements(receipt.result->'activity') item(value)
        where item.value->>'entity_type'=case
            when operation.value->>'entity' in('property_content','property_photos') then 'property'
            when operation.value->>'entity' in('room','room_content','room_photos','room_structure') then 'room_type'
            when operation.value->>'entity'='room_rate_price' then 'room_rate'
            when operation.value->>'entity' in('schedule_tier_price','room_rate_tier_price') then 'occupancy_tier'
            when operation.value->>'entity'='exact_date_price' then 'calendar_override'
            else 'daily_inventory' end
          and item.value->>'entity_id'=case
            when operation.value->>'entity' in('property_content','property_photos')
              then review.hotel_id::text else operation.value->>'id' end
          and item.value->>'action'=case
            when operation.value->>'entity' in('room','exact_date_price','daily_inventory')
              and (operation.value->>'expected_version')::bigint=0 then 'create'
            else 'update' end)
    ))
    and not exists(select 1 from public.hotel_activity_log activity
      where activity.source='hotels_v2_h3_2b_partner_workspace' and not exists(
        select 1 from public.hotel_partner_action_receipts receipt,
          lateral jsonb_array_elements(receipt.result->'activity') item(value)
        where receipt.correlation_id=activity.correlation_id
          and item.value->>'id'=activity.id::text))
    and not exists(select 1 from public.hotel_partner_workspace_plan_reviews review
      where review.consumed_at is not null and not exists(select 1
        from public.hotel_partner_action_receipts receipt
        where receipt.correlation_id=review.consumed_correlation_id
          and receipt.actor_user_id=review.actor_id and receipt.request_hash=review.plan_fingerprint)) value
), proposals as(
  select not exists(select 1 from public.hotel_partner_property_drafts draft
    where draft.status<>'pending_admin_review'
       or not exists(select 1 from public.hotel_partner_hotel_permissions permission
         where permission.assignment_id=draft.assignment_id and permission.partner_id=draft.partner_id
           and permission.hotel_id=draft.hotel_id)
       or not exists(select 1 from public.hotel_activity_log activity
         where activity.source='hotels_v2_h3_2b_partner_workspace' and activity.entity_type='property'
           and activity.entity_id=draft.hotel_id and activity.correlation_id=draft.correlation_id)) value
), security as(
  select not exists(select 1 from (values
      ('public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)'),
      ('public.hotel_v2_partner_preview_content_plan(jsonb)'),
      ('public.hotel_v2_partner_apply_content_plan(jsonb,uuid,uuid)'),
      ('public.hotel_v2_partner_preview_pricing_plan(jsonb)'),
      ('public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)'),
      ('public.hotel_v2_partner_preview_commercial_stay(jsonb)'),
      ('public.hotel_v2_partner_preview_availability_plan(jsonb)'),
      ('public.hotel_v2_partner_apply_availability_plan(jsonb,uuid,uuid)')) expected(signature)
    left join pg_proc procedure_row on procedure_row.oid=to_regprocedure(expected.signature)
    where procedure_row.oid is null or procedure_row.proowner<>'postgres'::regrole
      or not procedure_row.prosecdef
      or procedure_row.proconfig is distinct from array['search_path=pg_catalog, public, auth']::text[]
      or has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
      or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
      or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')
      or not has_function_privilege('authenticated',procedure_row.oid,'EXECUTE'))
    and not exists(select 1 from pg_proc procedure_row join pg_namespace namespace_row
      on namespace_row.oid=procedure_row.pronamespace
      where ((namespace_row.nspname='public' and procedure_row.proname like 'hotel_v2_h3_2b_%')
          or (namespace_row.nspname='hotels_v2_private' and procedure_row.proname like 'h3_2b_%'))
        and procedure_row.oid<>'hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb)'::regprocedure
        and (has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
          or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
          or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
          or has_function_privilege('service_role',procedure_row.oid,'EXECUTE')))
    and not exists(select 1 from (values('hotel_partner_property_drafts'),
      ('hotel_partner_workspace_plan_reviews'),('hotel_partner_workspace_foundation_receipts')) relation(name),
      unnest(array['anon','authenticated','service_role']) role_name(name),
      unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name(name)
      where has_table_privilege(role_name.name,'public.'||relation.name,privilege_name.name)
         or has_table_privilege(0::oid,'public.'||relation.name,privilege_name.name)) value
), diagnostics as(
  select case when (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{parity,total_case_count}')::integer=70
      and (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{parity,total_mismatch_count}')::integer=0
      then 0 else 1 end occupancy_mismatch,
    case when exists(select 1 from public.hotels where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
      and architecture_version='legacy' and md5(pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03')
      then 0 else 1 end legacy_price_mismatch,
    case when public.hotel_v2_h3_2b_flags_off() and not exists(select 1
      from public.partner_resources assignment join public.hotels hotel
        on assignment.resource_type='hotels' and hotel.id=assignment.resource_id
      where hotel.architecture_version<>'legacy') then 0 else 1 end public_mismatch,
    case when protected.value then 0 else 1 end booking_mismatch
  from protected
), verdict as(
  select protected.value and ledger.value and proposals.value and security.value
    and diagnostics.occupancy_mismatch=0 and diagnostics.legacy_price_mismatch=0
    and diagnostics.public_mismatch=0 and diagnostics.booking_mismatch=0 value
  from protected cross join ledger cross join proposals cross join security cross join diagnostics
)
select receipt.protected_fingerprints as protected_relation_fingerprints,
  jsonb_build_object('reviews',(select count(*) from public.hotel_partner_workspace_plan_reviews),
    'receipts',(select count(*) from public.hotel_partner_action_receipts
      where action in('h3_2b_content','h3_2b_pricing','h3_2b_availability')),
    'activity',(select count(*) from public.hotel_activity_log
      where source='hotels_v2_h3_2b_partner_workspace'),
    'property_drafts',(select count(*) from public.hotel_partner_property_drafts)) reviewed_partner_state,
  diagnostics.occupancy_mismatch as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  diagnostics.legacy_price_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  diagnostics.public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  diagnostics.booking_mismatch as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  case when verdict.value then true else
    format('HOTELS_V2_H3_2B_POST_PARTNER_VERIFY_FAILED_%s',clock_timestamp())::boolean end
    as hotels_v2_h3_2b_partner_hotel_workspace_post_partner_safe
from public.hotel_partner_workspace_foundation_receipts receipt
cross join diagnostics cross join verdict where receipt.id=1;
