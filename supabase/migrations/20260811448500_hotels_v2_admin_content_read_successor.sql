-- 114485: versioned Admin content READ only; frozen predecessor untouched.
-- Source lineage: exact 113400 body + the applied 114350 external-sync patch.
-- No writer, pricing, assignment, lifecycle or historical receipt evolution.
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='180s';
DO $pre$
BEGIN
 IF to_regprocedure('public.hotel_v2_admin_get_content_control_114485(uuid)') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448400')
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448400')
 OR hotels_guest_policy_private.raw_metadata('public.hotel_v2_admin_get_content_control(uuid)'::regprocedure)
 IS DISTINCT FROM '["e776cb4be19d7cb70ecb8db287c21709d3a87fbc1d9b044fdb62be57d154a83c", "769f5fd9ca10c25769a8af5ccbd7d11f44b76dc38bad0156dbfa9f7e39926784", "postgres", "{authenticated=X/postgres,postgres=X/postgres}", ["search_path=pg_catalog, public, auth"], "s", true, false, false, false, "plpgsql"]'::jsonb
 THEN RAISE EXCEPTION 'hotels_114485_predecessor_mismatch'; END IF;
 PERFORM hotels_guest_policy_private.assert_exact();
 IF public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS NOT TRUE
 OR hotels_lifecycle_private.public_booking_enabled() IS NOT FALSE
 THEN RAISE EXCEPTION 'hotels_114485_unsafe_boundary'; END IF;
END $pre$;
CREATE FUNCTION public.hotel_v2_admin_get_content_control_114485(p_hotel_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,auth
AS $function$
declare
  c_contract constant text:='hotels_v2_admin_b_content_control_v1';
  v_hotel public.hotels%rowtype;
  v_profile public.hotel_property_operational_profiles%rowtype;
  v_profile_exists boolean;
  v_assignment_snapshot jsonb;
  v_assignments jsonb;
begin
  perform public.hotel_v2_h2a_require_admin();
  if p_hotel_id is null then
    raise exception using errcode='22023',
      message='hotels_v2_admin_b_invalid_content_control_query';
  end if;
  select * into v_hotel from public.hotels where id=p_hotel_id;
  if not found then
    raise exception using errcode='PT404',
      message='hotels_v2_admin_b_property_not_found';
  end if;
  if (select count(*) from public.site_settings)<>1
     or exists(select 1 from public.site_settings where id<>1 or
       hotel_rooms_v2_enabled IS NULL OR hotel_external_sync_enabled IS NULL
       OR hotel_instant_booking_enabled IS DISTINCT FROM false
       OR hotel_stripe_connect_enabled IS DISTINCT FROM false
       OR hotels_lifecycle_private.public_booking_enabled() IS DISTINCT FROM false
       OR hotels_lifecycle_private.predecessor_flag_exact('hotel_rooms_v2_enabled',hotel_rooms_v2_enabled) IS DISTINCT FROM true) then
    raise exception using errcode='55000',
      message='hotels_v2_admin_b_public_activation_guard';
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
ALTER FUNCTION public.hotel_v2_admin_get_content_control_114485(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.hotel_v2_admin_get_content_control_114485(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hotel_v2_admin_get_content_control_114485(uuid) TO authenticated;
DO $post$
BEGIN
 IF hotels_guest_policy_private.raw_metadata('public.hotel_v2_admin_get_content_control(uuid)'::regprocedure)
 IS DISTINCT FROM '["e776cb4be19d7cb70ecb8db287c21709d3a87fbc1d9b044fdb62be57d154a83c", "769f5fd9ca10c25769a8af5ccbd7d11f44b76dc38bad0156dbfa9f7e39926784", "postgres", "{authenticated=X/postgres,postgres=X/postgres}", ["search_path=pg_catalog, public, auth"], "s", true, false, false, false, "plpgsql"]'::jsonb
 OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
 WHERE oid='public.hotel_v2_admin_get_content_control_114485(uuid)'::regprocedure) IS DISTINCT FROM '352382d0eafe572cb6caac97251c2cb39f076c9b96b96aa2bbc7e0e7496afd15'
 OR (hotels_guest_policy_private.raw_metadata('public.hotel_v2_admin_get_content_control_114485(uuid)'::regprocedure)-0-0)
 IS DISTINCT FROM ('["e776cb4be19d7cb70ecb8db287c21709d3a87fbc1d9b044fdb62be57d154a83c", "769f5fd9ca10c25769a8af5ccbd7d11f44b76dc38bad0156dbfa9f7e39926784", "postgres", "{authenticated=X/postgres,postgres=X/postgres}", ["search_path=pg_catalog, public, auth"], "s", true, false, false, false, "plpgsql"]'::jsonb-0-0)
 THEN RAISE EXCEPTION 'hotels_114485_source_security_mismatch'; END IF;
 PERFORM hotels_guest_policy_private.assert_exact();
 IF public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS NOT TRUE
 OR hotels_lifecycle_private.public_booking_enabled() IS NOT FALSE
 THEN RAISE EXCEPTION 'hotels_114485_postcondition_failed'; END IF;
END $post$;
NOTIFY pgrst,'reload schema';
COMMIT;
