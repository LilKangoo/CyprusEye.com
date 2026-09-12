-- 114487: read-only 7 Kamares content successor for the audited post-Stripe lifecycle.
-- Frozen 114485/114486 and every writer remain untouched; no decision/grant/data mutation.
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='180s';
DO $pre$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448600')
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations
   WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448600')
 OR to_regprocedure('public.hotel_v2_admin_get_content_control_114487(uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'hotels_114487_boundary_mismatch'; END IF;
 IF (SELECT count(*)=7 AND coalesce(bool_and(coalesce(
 p.oid IS NOT NULL AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.source
 AND p.proowner='postgres'::regrole AND p.prosecdef AND p.provolatile='s'
 AND NOT p.proisstrict AND NOT p.proleakproof AND NOT p.proretset
 AND p.prorettype=e.result::regtype AND l.lanname=e.language
 AND p.proconfig=ARRAY[e.config]
 AND (SELECT coalesce(jsonb_agg(jsonb_build_array(
  CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
  pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)
  ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
  pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable),'[]'::jsonb)
  FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)=e.acl,false)),false)
 FROM (VALUES
 ('public.hotel_v2_admin_get_content_control_114485(uuid)','352382d0eafe572cb6caac97251c2cb39f076c9b96b96aa2bbc7e0e7496afd15','plpgsql','search_path=pg_catalog, public, auth','jsonb','[["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('public.hotel_v2_admin_get_stripe_platform_readiness_114486()','1838e6de07b87f36b3a49fc9c001f85060f3a01aed9817120c070ed77a5602c6','plpgsql','search_path=pg_catalog, public, auth','jsonb','[["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('public.hotel_v2_admin_get_partner_hotel_permissions(uuid)','5800d0f35b7b4f289353946177e07daee7f6ce050009d457ba5fbac4f585d2ab','plpgsql','search_path=pg_catalog, public, auth','jsonb','[["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('hotels_lifecycle_private.safe_state()','780d8fd7853a49d3cab639d8590a786fe88302b6f254c44b9d68b85932a0da7e','plpgsql','search_path=pg_catalog, public','jsonb','[["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('hotels_lifecycle_private.chain_state()','a9bafdb21a9cce7007e14a25686a1c17606eaf2586b9778368aa9be25eba4c24','plpgsql','search_path=pg_catalog, public','jsonb','[["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('hotels_lifecycle_private.actual_flags()','ecd751821530611bfe8b925fa5bb73c408def4823acc1d794b70d6e5bb89fb59','sql','search_path=pg_catalog, public','jsonb','[["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('hotels_stripe_dto_private.business_hash()','3a236f4c31c6ecdce9b172330f86d2681f2eb0eaa2f63b2bab09203d39206ef8','plpgsql','search_path=pg_catalog, public','text','[["postgres","postgres","EXECUTE",false]]'::jsonb)
 ) e(signature,source,language,config,result,acl)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
 LEFT JOIN pg_language l ON l.oid=p.prolang) IS NOT TRUE
 THEN RAISE EXCEPTION 'hotels_114487_predecessor_source_security_mismatch'; END IF;
 PERFORM hotels_guest_policy_private.assert_exact();
 IF (hotels_lifecycle_private.safe_state() @> '{"contract_version":"hotels_v2_capability_lifecycle_v1","feature_flags":{"hotel_rooms_v2_enabled":true,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":true},"public_booking_enabled":false,"architecture":"legacy","expected_public_change":false,"audit_chain_exact":true}'::jsonb) IS NOT TRUE
 OR public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS NOT TRUE
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 THEN RAISE EXCEPTION 'hotels_114487_unsafe_boundary'; END IF;
 PERFORM set_config('hotels_114487.business_before',hotels_stripe_dto_private.business_hash(),true);
END $pre$;
CREATE FUNCTION public.hotel_v2_admin_get_content_control_114487(p_hotel_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,auth
AS $function$
declare
  c_contract constant text:='hotels_v2_admin_b_content_control_v1';
  v_hotel public.hotels%rowtype;
  v_profile public.hotel_property_operational_profiles%rowtype;
  v_profile_exists boolean;
  v_assignment_snapshot jsonb;
  v_lifecycle jsonb;
  v_assignments jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_hotel_id is null then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_invalid_content_control_query';
  end if;
  -- This successor is scoped to the reviewed 7 Kamares lifecycle only.
  if p_hotel_id<>'9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid then
    raise exception using errcode='PT404',message='hotels_v2_admin_b_property_not_found';
  end if;
  select * into v_hotel from public.hotels where id=p_hotel_id;
  if not found then
    raise exception using errcode='PT404',
      message='hotels_v2_admin_b_property_not_found';
  end if;
  -- safe_state verifies the immutable audited decision chain and exact current flags.
  -- No boolean-only inference, predecessor flag substitution, or writer delegation.
  v_lifecycle:=hotels_lifecycle_private.safe_state();
  if v_lifecycle->>'contract_version' IS DISTINCT FROM 'hotels_v2_capability_lifecycle_v1'
     or v_lifecycle->'feature_flags' IS DISTINCT FROM
       '{"hotel_rooms_v2_enabled":true,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":true}'::jsonb
     or v_lifecycle->'public_booking_enabled' IS DISTINCT FROM 'false'::jsonb
     or v_lifecycle->'expected_public_change' IS DISTINCT FROM 'false'::jsonb
     or v_lifecycle->'audit_chain_exact' IS DISTINCT FROM 'true'::jsonb
     or v_lifecycle->>'architecture' IS DISTINCT FROM 'legacy' then
    raise exception using errcode='55000',message='hotels_114487_post_stripe_lifecycle_required';
  end if;

  select * into v_profile
  from public.hotel_property_operational_profiles
  where hotel_id=p_hotel_id;
  v_profile_exists:=found;

  v_assignment_snapshot:=public.hotel_v2_admin_get_partner_hotel_permissions(p_hotel_id);
  select coalesce(jsonb_agg(
    assignment.value||jsonb_build_object(
      'staff_scope_count',(
        select count(*)::integer
        from public.partner_user_resources scope_row
        join public.partner_users membership
          on membership.id=scope_row.partner_user_id
        where membership.partner_id=(assignment.value->>'partner_id')::uuid
          and scope_row.resource_type='hotels'
          and scope_row.resource_id=p_hotel_id
      ),
      'staff_scope_ids',coalesce((
        select jsonb_agg(scope_row.id order by scope_row.id)
        from public.partner_user_resources scope_row
        join public.partner_users membership
          on membership.id=scope_row.partner_user_id
        where membership.partner_id=(assignment.value->>'partner_id')::uuid
          and scope_row.resource_type='hotels'
          and scope_row.resource_id=p_hotel_id
      ),'[]'::jsonb),
      'permission_exists',coalesce((assignment.value#>>'{permission,exists}')::boolean,false),
      'permission_will_cascade_on_remove',
        coalesce((assignment.value#>>'{permission,exists}')::boolean,false)
    ) order by assignment.ordinal
  ),'[]'::jsonb) into v_assignments
  from jsonb_array_elements(coalesce(v_assignment_snapshot->'assignments','[]'::jsonb))
    with ordinality assignment(value,ordinal);

  v_assignment_snapshot:=jsonb_set(
    v_assignment_snapshot,'{assignments}',v_assignments,false
  );

  return jsonb_build_object(
    'contract_version',c_contract,
    'hotel_id',v_hotel.id,
    'property_updated_at',v_hotel.updated_at,
    'architecture_version',v_hotel.architecture_version,
    'feature_flags',v_assignment_snapshot->'feature_flags',
    'commercial_owner',(
      select case when partner.id is null then null else jsonb_build_object(
        'partner_id',partner.id,'name',partner.name,'status',partner.status,
        'can_manage_hotels',partner.can_manage_hotels
      ) end
      from (select 1) singleton
      left join public.partners partner on partner.id=v_hotel.owner_partner_id
    ),
    'operational_profile',case when v_profile_exists then jsonb_build_object(
      'exists',true,'version',v_profile.version,'updated_at',v_profile.updated_at,
      'maximum_stay_nights',v_profile.maximum_stay_nights,
      'guest_instructions_i18n',v_profile.guest_instructions_i18n,
      'check_in_instructions_i18n',v_profile.check_in_instructions_i18n,
      'check_out_instructions_i18n',v_profile.check_out_instructions_i18n,
      'internal_operational_notes',v_profile.internal_operational_notes
    ) else jsonb_build_object(
      'exists',false,'version',0,'updated_at',null,
      'maximum_stay_nights',null,
      'guest_instructions_i18n','{}'::jsonb,
      'check_in_instructions_i18n','{}'::jsonb,
      'check_out_instructions_i18n','{}'::jsonb,
      'internal_operational_notes',null
    ) end,
    'assignment_snapshot',v_assignment_snapshot
  );
end
$function$;
ALTER FUNCTION public.hotel_v2_admin_get_content_control_114487(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.hotel_v2_admin_get_content_control_114487(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hotel_v2_admin_get_content_control_114487(uuid) TO authenticated;
DO $post$
BEGIN
 IF (SELECT count(*)=8 AND coalesce(bool_and(coalesce(
 p.oid IS NOT NULL AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.source
 AND p.proowner='postgres'::regrole AND p.prosecdef AND p.provolatile='s'
 AND NOT p.proisstrict AND NOT p.proleakproof AND NOT p.proretset
 AND p.prorettype=e.result::regtype AND l.lanname=e.language
 AND p.proconfig=ARRAY[e.config]
 AND (SELECT coalesce(jsonb_agg(jsonb_build_array(
  CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
  pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)
  ORDER BY CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
  pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable),'[]'::jsonb)
  FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)=e.acl,false)),false)
 FROM (VALUES
 ('public.hotel_v2_admin_get_content_control_114485(uuid)','352382d0eafe572cb6caac97251c2cb39f076c9b96b96aa2bbc7e0e7496afd15','plpgsql','search_path=pg_catalog, public, auth','jsonb','[["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('public.hotel_v2_admin_get_stripe_platform_readiness_114486()','1838e6de07b87f36b3a49fc9c001f85060f3a01aed9817120c070ed77a5602c6','plpgsql','search_path=pg_catalog, public, auth','jsonb','[["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('public.hotel_v2_admin_get_partner_hotel_permissions(uuid)','5800d0f35b7b4f289353946177e07daee7f6ce050009d457ba5fbac4f585d2ab','plpgsql','search_path=pg_catalog, public, auth','jsonb','[["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('hotels_lifecycle_private.safe_state()','780d8fd7853a49d3cab639d8590a786fe88302b6f254c44b9d68b85932a0da7e','plpgsql','search_path=pg_catalog, public','jsonb','[["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('hotels_lifecycle_private.chain_state()','a9bafdb21a9cce7007e14a25686a1c17606eaf2586b9778368aa9be25eba4c24','plpgsql','search_path=pg_catalog, public','jsonb','[["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('hotels_lifecycle_private.actual_flags()','ecd751821530611bfe8b925fa5bb73c408def4823acc1d794b70d6e5bb89fb59','sql','search_path=pg_catalog, public','jsonb','[["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('hotels_stripe_dto_private.business_hash()','3a236f4c31c6ecdce9b172330f86d2681f2eb0eaa2f63b2bab09203d39206ef8','plpgsql','search_path=pg_catalog, public','text','[["postgres","postgres","EXECUTE",false]]'::jsonb),
 ('public.hotel_v2_admin_get_content_control_114487(uuid)','4d4d9cf8da8210a9c2404ee8894c5b910efca774a8d22e340e9810aec9dd14f1','plpgsql','search_path=pg_catalog, public, auth','jsonb','[["authenticated","postgres","EXECUTE",false],["postgres","postgres","EXECUTE",false]]'::jsonb)
 ) e(signature,source,language,config,result,acl)
 LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
 LEFT JOIN pg_language l ON l.oid=p.prolang) IS NOT TRUE
 THEN RAISE EXCEPTION 'hotels_114487_source_security_postcondition_failed'; END IF;
 PERFORM hotels_guest_policy_private.assert_exact();
 IF (hotels_lifecycle_private.safe_state() @> '{"contract_version":"hotels_v2_capability_lifecycle_v1","feature_flags":{"hotel_rooms_v2_enabled":true,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":true},"public_booking_enabled":false,"architecture":"legacy","expected_public_change":false,"audit_chain_exact":true}'::jsonb) IS NOT TRUE
 OR public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS NOT TRUE
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 OR hotels_stripe_dto_private.business_hash() IS DISTINCT FROM current_setting('hotels_114487.business_before')
 THEN RAISE EXCEPTION 'hotels_114487_business_postcondition_failed'; END IF;
END $post$;
NOTIFY pgrst,'reload schema';
COMMIT;
