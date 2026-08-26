-- Post-deploy/post-Apply production verifier. Safe is true only after the
-- reviewed activation was consumed and the exact audit/evolution chain holds.
-- This is the normal post-114400 verifier: it supersedes the pre-activation
-- H3.2B post-Partner verifier's intentionally immutable Task2 baseline check.

do $verify$
declare v_snapshot jsonb; v_signature text; v_oid oid; v_relation text;
  v_role text; v_privilege text;
begin
  if to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_current_is_safe()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_receipt_is_exact()') is null
     or to_regprocedure('public.hotel_v2_seven_arches_pricing_activation_snapshot()') is null
     or to_regprocedure('public.hotel_v2_admin_get_seven_arches_pricing_activation()') is null
     or to_regprocedure('public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)') is null
     or to_regprocedure('public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)') is null
     or to_regclass('public.hotel_seven_arches_pricing_activation_evolution_receipts') is null then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_VERIFY_FAIL: activation objects missing';
  end if;
  foreach v_signature in array array[
    'public.hotel_v2_admin_get_seven_arches_pricing_activation()',
    'public.hotel_v2_admin_preview_seven_arches_pricing_activation(jsonb)',
    'public.hotel_v2_admin_apply_seven_arches_pricing_activation(jsonb,uuid,text)'
  ] loop
    v_oid:=to_regprocedure(v_signature);
    if (select proowner from pg_proc where oid=v_oid)<>'postgres'::regrole
       or not (select prosecdef from pg_proc where oid=v_oid)
       or (select proconfig from pg_proc where oid=v_oid)
          is distinct from array['search_path=pg_catalog, public, auth']::text[]
       or has_function_privilege(0::oid,v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE')
       or has_function_privilege('service_role',v_oid,'EXECUTE')
       or not has_function_privilege('authenticated',v_oid,'EXECUTE') then
      raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_VERIFY_FAIL: RPC ACL drift %',v_signature;
    end if;
  end loop;
  foreach v_relation in array array['hotel_seven_arches_pricing_activation_reviews',
    'hotel_seven_arches_pricing_activation_transaction_context',
    'hotel_seven_arches_pricing_activation_evolution_receipts'] loop
    foreach v_role in array array['anon','authenticated','service_role'] loop
      foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(0::oid,('public.'||v_relation)::regclass,v_privilege)
           or has_table_privilege(v_role,('public.'||v_relation)::regclass,v_privilege) then
          raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_VERIFY_FAIL: raw ACL drift %.%.%',
            v_relation,v_role,v_privilege;
        end if;
      end loop;
    end loop;
  end loop;
  v_snapshot:=public.hotel_v2_seven_arches_pricing_activation_snapshot();
  if v_snapshot->>'status'<>'active'
     or jsonb_array_length(v_snapshot->'blocking_reasons')<>0
     or not public.hotel_v2_seven_arches_pricing_activation_current_is_safe()
     or v_snapshot#>>'{h3_1p,parity,total_case_count}'<>'70'
     or v_snapshot#>>'{h3_1p,parity,total_mismatch_count}'<>'0'
     or v_snapshot#>>'{h3_1p,allocation_exact}'<>'true'
     or v_snapshot#>>'{rate_plan,is_active}'<>'true'
     or (select count(*) from jsonb_array_elements(v_snapshot->'room_rates') rate
       where rate.value->>'is_active'='true' and (rate.value->>'base_nightly_rate')::numeric>0)<>2
     or v_snapshot#>>'{shared_schedule,is_active}'<>'true'
     or v_snapshot#>>'{preview_schedule,is_active}'<>'false'
     or v_snapshot#>>'{payment_policy,is_active}'<>'true'
     or v_snapshot#>>'{payment_policy,review_status}'<>'reviewed'
     or v_snapshot#>>'{commission_policy,commission_mode}'<>'per_allocated_room_per_night'
     or (v_snapshot#>>'{commission_policy,amount}')::numeric<>10
     or v_snapshot#>>'{commission_policy,currency}'<>'EUR'
     or v_snapshot#>>'{commission_policy,read_only}'<>'true'
     or v_snapshot#>>'{feature_flags,hotel_rooms_v2_enabled}'<>'false'
     or v_snapshot#>>'{feature_flags,hotel_instant_booking_enabled}'<>'false'
     or v_snapshot#>>'{feature_flags,hotel_stripe_connect_enabled}'<>'false'
     or v_snapshot->>'legacy_authoritative'<>'true'
     or v_snapshot->>'public_change'<>'false'
     or public.hotel_v2_h3_1p_pricing_promotion_snapshot(
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{supported}'<>'true'
     or public.hotel_v2_h3_1p_pricing_promotion_snapshot(
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{activation,status}'<>'active'
     or public.hotel_v2_h3_1p_pricing_promotion_snapshot(
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{safety,reviewed_activation_exact}'<>'true'
     or public.hotel_v2_h3_1p_pricing_promotion_snapshot(
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{parity,total_case_count}'<>'70'
     or public.hotel_v2_h3_1p_pricing_promotion_snapshot(
       '9b6d99a0-923a-4fbc-be54-c066e856e6ca')#>>'{parity,total_mismatch_count}'<>'0' then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_VERIFY_FAIL: active state/audit drift';
  end if;
  if (select count(*) from public.hotel_seven_arches_pricing_activation_evolution_receipts)<>1
     or (select count(*) from public.hotel_pricing_promotion_reviews
       where hotel_id='9b6d99a0-923a-4fbc-be54-c066e856e6ca'
         and contract_version='seven_kamares_legacy_to_h3_pricing_v1'
         and review_status='reviewed' and parity_case_count=70
         and parity_mismatch_count=0)<>1
     or (select count(*) from public.hotel_partner_property_proposal_foundation_receipts)<>1
     or (select count(*) from public.hotel_seven_arches_pricing_activation_reviews
       where consumed_at is not null)<>1
     or exists(select 1 from public.hotel_seven_arches_pricing_activation_transaction_context)
     or (select count(*) from public.hotel_activity_log
       where source='hotels_v2_seven_arches_pricing_activation')<>4 then
    raise exception 'HOTELS_V2_7A_PRICING_ACTIVATION_VERIFY_FAIL: receipt/activity cardinality drift';
  end if;
end
$verify$;

select
  'HOTELS_V2_7A_PRICING_ACTIVATION_VERIFY_OK' as sentinel,
  public.hotel_v2_seven_arches_pricing_activation_current_is_safe() as safe,
  public.hotel_v2_seven_arches_pricing_activation_snapshot() as activation;
