-- H3.2B Partner Hotel workspace foundation verifier (READ ONLY).
-- Run in a fresh Supabase SQL Editor session immediately after migration 138.

do $verify$
declare v_signature text; v_admin text; v_partner text; v_expected text; v_h3 jsonb;
  v_public text[]:=array[
    'public.hotel_v2_partner_get_workspace(uuid,uuid,date,date)',
    'public.hotel_v2_partner_preview_content_plan(jsonb)',
    'public.hotel_v2_partner_apply_content_plan(jsonb,uuid,uuid)',
    'public.hotel_v2_partner_preview_pricing_plan(jsonb)',
    'public.hotel_v2_partner_apply_pricing_plan(jsonb,uuid,uuid)',
    'public.hotel_v2_partner_preview_commercial_stay(jsonb)',
    'public.hotel_v2_partner_preview_availability_plan(jsonb)',
    'public.hotel_v2_partner_apply_availability_plan(jsonb,uuid,uuid)'];
begin
  if to_regclass('public.hotel_partner_property_drafts') is null
     or to_regclass('public.hotel_partner_workspace_plan_reviews') is null
     or to_regclass('public.hotel_partner_workspace_foundation_receipts') is null then
    raise exception 'HOTELS_V2_H3_2B_VERIFY_FAIL: relation missing';
  end if;
  foreach v_signature in array v_public loop
    if to_regprocedure(v_signature) is null or not exists(select 1 from pg_proc procedure_row
        where procedure_row.oid=v_signature::regprocedure and procedure_row.proowner='postgres'::regrole
          and procedure_row.prosecdef
          and procedure_row.proconfig=array['search_path=pg_catalog, public, auth']::text[])
       or not has_function_privilege('authenticated',v_signature,'EXECUTE')
       or has_function_privilege(0::oid,v_signature,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE') then
      raise exception 'HOTELS_V2_H3_2B_VERIFY_FAIL: public RPC security mismatch: %',v_signature;
    end if;
  end loop;
  if exists(select 1 from pg_proc procedure_row join pg_namespace namespace_row
      on namespace_row.oid=procedure_row.pronamespace
      where ((namespace_row.nspname='public' and procedure_row.proname like 'hotel_v2_h3_2b_%')
          or (namespace_row.nspname='hotels_v2_private' and procedure_row.proname like 'h3_2b_%'))
        and procedure_row.proowner<>'postgres'::regrole)
     or exists(select 1 from pg_proc procedure_row join pg_namespace namespace_row
      on namespace_row.oid=procedure_row.pronamespace
      where ((namespace_row.nspname='public' and procedure_row.proname like 'hotel_v2_h3_2b_%')
          or (namespace_row.nspname='hotels_v2_private' and procedure_row.proname like 'h3_2b_%'))
        and procedure_row.oid<>'hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb)'::regprocedure
        and (has_function_privilege(0::oid,procedure_row.oid,'EXECUTE')
          or has_function_privilege('anon',procedure_row.oid,'EXECUTE')
          or has_function_privilege('authenticated',procedure_row.oid,'EXECUTE')
          or has_function_privilege('service_role',procedure_row.oid,'EXECUTE'))) then
    raise exception 'HOTELS_V2_H3_2B_VERIFY_FAIL: internal helper metadata/ACL mismatch';
  end if;
  if not has_function_privilege('authenticated',
      'hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb)','EXECUTE')
     or has_function_privilege(0::oid,
      'hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb)','EXECUTE')
     or has_function_privilege('anon',
      'hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb)','EXECUTE')
     or has_function_privilege('service_role',
      'hotels_v2_private.h3_2b_can_insert_photo(text,text,jsonb)','EXECUTE')
     or not has_schema_privilege('authenticated','hotels_v2_private','USAGE')
     or has_schema_privilege('authenticated','hotels_v2_private','CREATE')
     or has_schema_privilege(0::oid,'hotels_v2_private','USAGE')
     or has_schema_privilege('anon','hotels_v2_private','USAGE')
     or has_schema_privilege('service_role','hotels_v2_private','USAGE') then
    raise exception 'HOTELS_V2_H3_2B_VERIFY_FAIL: private Storage boundary mismatch';
  end if;
  if exists(select 1 from (values('hotel_partner_property_drafts'),
      ('hotel_partner_workspace_plan_reviews'),('hotel_partner_workspace_foundation_receipts')) relation(name),
      unnest(array['anon','authenticated','service_role']) role_name(name),
      unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name(name)
      where has_table_privilege(role_name.name,'public.'||relation.name,privilege_name.name)
         or has_table_privilege(0::oid,'public.'||relation.name,privilege_name.name)) then
    raise exception 'HOTELS_V2_H3_2B_VERIFY_FAIL: raw H3.2B relation exposed';
  end if;
  if not exists(select 1 from pg_policies policy where policy.schemaname='storage'
      and policy.tablename='objects' and policy.policyname='hotel_partner_h3_2b_photo_insert'
      and policy.cmd='INSERT' and policy.roles='{authenticated}'::name[]
      and policy.with_check='hotels_v2_private.h3_2b_can_insert_photo(bucket_id, name, metadata)') then
    raise exception 'HOTELS_V2_H3_2B_VERIFY_FAIL: Storage policy mismatch';
  end if;
  if exists(select 1 from unnest(array[
      'hotel_partner_property_drafts_guard','hotel_partner_workspace_plan_reviews_guard',
      'hotel_partner_workspace_foundation_receipts_immutable']) expected(name)
      where not exists(select 1 from pg_trigger trigger_row where trigger_row.tgname=expected.name
        and not trigger_row.tgisinternal)) then
    raise exception 'HOTELS_V2_H3_2B_VERIFY_FAIL: trigger matrix mismatch';
  end if;
  if not exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
      where receipt.id=1
        and receipt.protected_fingerprint=public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints)) then
    raise exception 'HOTELS_V2_H3_2B_VERIFY_FAIL: foundation receipt integrity mismatch';
  end if;
  if exists(select 1 from public.hotel_partner_workspace_plan_reviews)
     or exists(select 1 from public.hotel_partner_property_drafts)
     or exists(select 1 from public.hotel_partner_action_receipts
       where action in('h3_2b_content','h3_2b_pricing','h3_2b_availability'))
     or exists(select 1 from public.hotel_activity_log
       where source='hotels_v2_h3_2b_partner_workspace') then
    raise exception 'HOTELS_V2_H3_2B_VERIFY_FAIL: foundation is not empty';
  end if;
  select pg_get_functiondef('public.hotel_v2_admin_preview_pricing_quote(jsonb)'::regprocedure),
    pg_get_functiondef('public.hotel_v2_h3_2b_pricing_quote_core(jsonb)'::regprocedure)
    into v_admin,v_partner;
  v_expected:=replace(v_admin,'hotel_v2_admin_preview_pricing_quote','hotel_v2_h3_2b_pricing_quote_core');
  v_expected:=replace(v_expected,'perform public.hotel_v2_h2a_require_admin();',
    'perform 1 /* H3.2B outer RPC already proved exact Partner access */;');
  if v_partner is distinct from v_expected then
    raise exception 'HOTELS_V2_H3_2B_VERIFY_FAIL: ADMIN-C quote clone drift';
  end if;
  v_h3:=public.hotel_v2_h3_1p_pricing_promotion_snapshot(
    '9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid);
  if not public.hotel_v2_h3_2b_flags_off()
     or exists(select 1 from public.partner_resources assignment join public.hotels hotel
       on assignment.resource_type='hotels' and hotel.id=assignment.resource_id
       where hotel.architecture_version<>'legacy')
     or (v_h3#>>'{parity,total_case_count}')::integer<>70
     or (v_h3#>>'{parity,total_mismatch_count}')::integer<>0
     or not public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() then
    raise exception 'HOTELS_V2_H3_2B_VERIFY_FAIL: legacy/H3.1P invariant mismatch';
  end if;
end
$verify$;

with protected as(select exists(select 1 from public.hotel_partner_workspace_foundation_receipts receipt
    where receipt.id=1
      and receipt.protected_fingerprint=public.hotel_v2_h3_2b_hash(receipt.protected_fingerprints)) value),
diagnostics as(select
  case when (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{parity,total_case_count}')::integer=70
    and (public.hotel_v2_h3_1p_pricing_promotion_snapshot(
      '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{parity,total_mismatch_count}')::integer=0
    and public.hotel_v2_admin_c_seven_kamares_allocation_contract_is_exact() then 0 else 1 end occupancy_mismatch,
  case when exists(select 1 from public.hotels
      where id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' and architecture_version='legacy'
        and md5(pricing_tiers::text)='7208ab4ecc0e47abd64d87ca1ac53a03') then 0 else 1 end legacy_mismatch,
  case when public.hotel_v2_h3_2b_flags_off() and not exists(select 1
      from public.partner_resources assignment join public.hotels hotel
      on assignment.resource_type='hotels' and hotel.id=assignment.resource_id
      where hotel.architecture_version<>'legacy') then 0 else 1 end public_mismatch,
  case when protected.value then 0 else 1 end booking_mismatch from protected)
select receipt.protected_fingerprints as protected_relation_fingerprints,
  receipt.protected_fingerprint,
  diagnostics.occupancy_mismatch as "HOTEL_7_ARCHES_OCCUPANCY_PRICE_MISMATCH",
  diagnostics.legacy_mismatch as "HOTEL_LEGACY_PRICE_MISMATCH",
  diagnostics.public_mismatch as "HOTEL_LEGACY_PUBLIC_MISMATCH",
  diagnostics.booking_mismatch as "HOTEL_BOOKING_PAYLOAD_UNEXPLAINED_DIFFERENCE",
  diagnostics.occupancy_mismatch=0 and diagnostics.legacy_mismatch=0
    and diagnostics.public_mismatch=0 and diagnostics.booking_mismatch=0
    as hotels_v2_h3_2b_partner_hotel_workspace_foundation_safe
from public.hotel_partner_workspace_foundation_receipts receipt
cross join diagnostics where receipt.id=1;
