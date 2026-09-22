-- Additive read only: the fingerprint-protected historical discovery RPC is
-- deliberately unchanged. No ledger, receipt, assignment or business writes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre_114491$
DECLARE p record;
BEGIN
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations
      WHERE version='20260811449000') <> 1
     OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
       WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811449000')
     OR to_regprocedure('public.hotel_v2_partner_list_assigned_properties_114491(uuid)') IS NOT NULL
  THEN RAISE EXCEPTION 'hotels_114491_boundary_mismatch'; END IF;

  -- Pins are prosrc hashes, not pg_get_functiondef or catalog-envelope hashes.
  FOR p IN
    SELECT e.*, f.oid, f.prosrc, f.proowner, f.prosecdef, f.provolatile,
      f.proconfig, f.prorettype, f.proretset, f.proisstrict, f.proleakproof,
      f.proacl, l.lanname
    FROM (VALUES
      ('public.hotel_v2_partner_list_assigned_properties(uuid)',
       '01a3987c9596801a9bdbb34df9bc2825d60daad2e83f0f7c0c8f5e7df82af6a3',
       ARRAY['search_path=pg_catalog, public, auth'], true),
      ('public.hotel_v2_h3_2a_require_partner_membership(uuid)',
       '90ad483c8ae6c061d69f9b05e2a7b205219a7dbf37047e750a0a507835814b50',
       ARRAY['search_path=pg_catalog, public, auth'], false),
      ('public.hotel_v2_h3_2a_effective_partner_permissions(uuid,text)',
       '1e35326dcdfa2edad59391a671f4507fcd9b4e328543a5db16ca7c8ac706cf25',
       ARRAY['search_path=pg_catalog, public'], false),
      ('hotels_post_114489_private.safe_state_114490()',
       '827a607a09a6d982cd1345342b58a2e7abf9961a93fd9ce8bd598c7a49fb77a7',
       ARRAY['search_path=pg_catalog, public'], false)
    ) e(signature, source_sha, config, authenticated_access)
    LEFT JOIN pg_proc f ON f.oid=to_regprocedure(e.signature)
    LEFT JOIN pg_language l ON l.oid=f.prolang
  LOOP
    IF p.oid IS NULL OR p.proowner<>'postgres'::regrole
      OR p.prosecdef IS DISTINCT FROM true OR p.provolatile<>'s'
      OR p.lanname<>'plpgsql' OR p.prorettype<>'jsonb'::regtype
      OR p.proretset OR p.proisstrict OR p.proleakproof
      OR p.proconfig IS DISTINCT FROM p.config
      OR encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') IS DISTINCT FROM p.source_sha
      OR (SELECT count(*) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))))
         <> (CASE WHEN p.authenticated_access THEN 2 ELSE 1 END)
      OR EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        WHERE a.grantor<>'postgres'::regrole OR a.privilege_type<>'EXECUTE' OR a.is_grantable
          OR NOT (a.grantee='postgres'::regrole
            OR (p.authenticated_access AND a.grantee='authenticated'::regrole)))
    THEN RAISE EXCEPTION 'hotels_114491_predecessor_drift: %',p.signature; END IF;
  END LOOP;
END
$pre_114491$;

CREATE FUNCTION public.hotel_v2_partner_list_assigned_properties_114491(p_partner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog, public, auth, pg_temp
AS $function$
declare
  v_membership jsonb;
  v_partner_user_id uuid;
  v_role text;
  v_properties jsonb;
  v_property_count integer;
  v_lifecycle jsonb;
begin
  v_membership := public.hotel_v2_h3_2a_require_partner_membership(p_partner_id);
  v_partner_user_id := (v_membership->>'partner_user_id')::uuid;
  v_role := v_membership->>'role';

  -- One certified post-conversion lifecycle read. No historical live catalog
  -- validation, loose boolean casts, cached caller input or raw fallback.
  v_lifecycle := hotels_post_114489_private.safe_state_114490();
  if (select count(*) from public.site_settings) <> 1
     or not exists (select 1 from public.site_settings setting where setting.id=1
       and setting.hotel_rooms_v2_enabled is true
       and setting.hotel_external_sync_enabled is true
       and setting.hotel_instant_booking_enabled is false
       and setting.hotel_stripe_connect_enabled is true)
     or v_lifecycle->'feature_flags' is distinct from
       '{"hotel_rooms_v2_enabled":true,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":true}'::jsonb
     or v_lifecycle->'public_booking_enabled' is distinct from 'false'::jsonb
     or v_lifecycle->'expected_public_change' is distinct from 'false'::jsonb
     or v_lifecycle->'audit_chain_exact' is distinct from 'true'::jsonb
     or v_lifecycle->>'architecture' is distinct from 'legacy'
     or v_lifecycle->>'contract_version' is distinct from 'hotels_v2_capability_lifecycle_v1'
  then
    raise exception using errcode = '55000', message = 'hotels_v2_h3_2a_public_activation_guard';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id', assignment.id,
    'hotel_id', hotel.id,
    'slug', hotel.slug,
    'name_i18n', jsonb_build_object(
      'pl', coalesce(hotel.title_i18n->>'pl', hotel.title->>'pl', hotel.title_i18n->>'en', hotel.title->>'en', hotel.slug),
      'en', coalesce(hotel.title_i18n->>'en', hotel.title->>'en', hotel.title_i18n->>'pl', hotel.title->>'pl', hotel.slug),
      'he', coalesce(hotel.title_i18n->>'he', hotel.title->>'he', hotel.title_i18n->>'en', hotel.title->>'en', hotel.slug)
    ),
    'city', hotel.city,
    'cover_image_url', hotel.cover_image_url,
    'foundation_status', 'foundation_only',
    'workspace_available', false,
    'permission', public.hotel_v2_h3_2a_effective_partner_permissions(assignment.id, v_role)
  ) order by hotel.sort_order, hotel.id), '[]'::jsonb)
  into v_properties
  from public.partner_resources assignment
  join public.hotels hotel on hotel.id = assignment.resource_id
  where assignment.partner_id = p_partner_id
    and assignment.resource_type = 'hotels'
    and (
      v_role = 'owner'
      or exists (
        select 1
        from public.partner_user_resources user_scope
        where user_scope.partner_user_id = v_partner_user_id
          and user_scope.resource_type = 'hotels'
          and user_scope.resource_id = hotel.id
      )
    );

  v_property_count := jsonb_array_length(v_properties);
  if v_property_count = 0 then
    -- Discovery never turns a missing exact assignment/scope into a successful
    -- empty workspace. Owners need an assignment; staff additionally need at
    -- least one exact Hotel scope.
    raise exception using errcode = '42501', message = 'hotels_v2_h3_2a_partner_access_denied';
  end if;

  return jsonb_build_object(
    'contract_version', 'hotels_v2_h3_2a_partner_permissions_v1',
    'partner', jsonb_build_object('id', p_partner_id, 'role', v_role),
    'foundation_only', true,
    'workspace_available', false,
    'properties', v_properties
  );
end
$function$;
ALTER FUNCTION public.hotel_v2_partner_list_assigned_properties_114491(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.hotel_v2_partner_list_assigned_properties_114491(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hotel_v2_partner_list_assigned_properties_114491(uuid) TO authenticated;

DO $post_114491$
DECLARE p pg_proc%rowtype;
BEGIN
  SELECT * INTO STRICT p FROM pg_proc
    WHERE oid='public.hotel_v2_partner_list_assigned_properties_114491(uuid)'::regprocedure;
  IF p.proowner<>'postgres'::regrole OR p.prosecdef IS DISTINCT FROM true
    OR p.provolatile<>'s' OR p.prorettype<>'jsonb'::regtype
    OR p.prolang<>(SELECT oid FROM pg_language WHERE lanname='plpgsql')
    OR p.proretset OR p.proisstrict OR p.proleakproof
    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, auth, pg_temp']
    OR p.prosrc ~ 'hotels_lifecycle_private\.(predecessor_flag_exact|safe_state|chain_state|catalog_snapshot)\s*\('
    OR (SELECT count(*) FROM aclexplode(p.proacl))<>2
    OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
      WHERE a.grantor<>'postgres'::regrole OR a.privilege_type<>'EXECUTE' OR a.is_grantable
        OR a.grantee NOT IN ('postgres'::regrole,'authenticated'::regrole))
    OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
      WHERE oid='public.hotel_v2_partner_list_assigned_properties(uuid)'::regprocedure)
      IS DISTINCT FROM '01a3987c9596801a9bdbb34df9bc2825d60daad2e83f0f7c0c8f5e7df82af6a3'
  THEN RAISE EXCEPTION 'hotels_114491_postcondition_failed'; END IF;
END
$post_114491$;
COMMIT;
