-- Additive H2B1 lifecycle adapter. No historical function/receipt is rewritten.
-- Completed successor pricing is never routed through the historical writer.
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='180s';
LOCK TABLE public.site_settings,public.hotels IN SHARE MODE;
DO $pre$ BEGIN
 IF to_regnamespace('hotels_shadow_successor_private') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260811448100')
 OR EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version ~ '^20260811[0-9]{6}$' AND version>'20260811448100')
 THEN RAISE EXCEPTION 'hotels_114482_boundary_mismatch'; END IF;
 PERFORM hotels_stripe_dto_private.assert_exact();
 IF hotels_lineage_private.current_anchor_is_exact() IS NOT TRUE
 OR public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() IS NOT TRUE
 OR public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() IS NOT TRUE
 OR public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS NOT TRUE
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 OR hotels_lifecycle_private.safe_state() IS DISTINCT FROM
   (hotels_lifecycle_private.safe_state() || '{"feature_flags":{"hotel_rooms_v2_enabled":false,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":false},"public_booking_enabled":false,"architecture":"legacy"}'::jsonb)
 THEN RAISE EXCEPTION 'hotels_114482_precondition_failed'; END IF;
 IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
 WHERE oid='public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)
 IS DISTINCT FROM '31383ecd2bd2525f5725b0c629e187f8db54515cc007649173cdbf1d24b9b74a'
 OR hotels_lifecycle_private.metadata('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)
 IS DISTINCT FROM '{"acl":[["authenticated","EXECUTE",false],["postgres","EXECUTE",false]],"owner":"postgres","config":["search_path=pg_catalog, public, auth"],"strict":false,"language":"plpgsql","leakproof":false,"volatility":"v","returns_set":false,"security_definer":true}'::jsonb
 THEN RAISE EXCEPTION 'hotels_114482_predecessor_drift'; END IF;
 PERFORM set_config('hotels_114482.business_before',hotels_stripe_dto_private.business_hash(),true);
END $pre$;

CREATE SCHEMA hotels_shadow_successor_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA hotels_shadow_successor_private FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE hotels_shadow_successor_private.certificate(
 id integer PRIMARY KEY CHECK(id=1),functions jsonb NOT NULL,business_hash text NOT NULL
);
ALTER TABLE hotels_shadow_successor_private.certificate ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels_shadow_successor_private.certificate FORCE ROW LEVEL SECURITY;
REVOKE ALL ON hotels_shadow_successor_private.certificate FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION hotels_shadow_successor_private.immutable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f$
BEGIN RAISE EXCEPTION 'hotels_114482_certificate_immutable'; END $f$;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON hotels_shadow_successor_private.certificate
FOR EACH STATEMENT EXECUTE FUNCTION hotels_shadow_successor_private.immutable();

CREATE FUNCTION hotels_shadow_successor_private.catalog() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
 SELECT jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object(
 'source',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),
 'definition',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),
 'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,'config',p.proconfig,
 'definer',p.prosecdef,'volatility',p.provolatile,'language',l.lanname)
 ORDER BY p.oid::regprocedure::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname='hotels_shadow_successor_private' OR p.oid IN(
 to_regprocedure('public.hotel_v2_admin_get_shadow_preparation_state(uuid)'),
 to_regprocedure('public.hotel_v2_admin_prepare_shadow_rooms_successor(jsonb,uuid)'),
 'public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure)
$f$;
CREATE FUNCTION hotels_shadow_successor_private.assert_exact() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE c jsonb;
BEGIN
 SELECT functions INTO STRICT c FROM hotels_shadow_successor_private.certificate WHERE id=1;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='hotels_shadow_successor_private.certificate'::regclass
  AND relowner='postgres'::regrole AND relrowsecurity AND relforcerowsecurity)
 OR EXISTS(SELECT 1 FROM pg_class r,LATERAL aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) a
  WHERE r.oid='hotels_shadow_successor_private.certificate'::regclass AND a.grantee<>r.relowner)
 OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='hotels_shadow_successor_private.certificate'::regclass)
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='hotels_shadow_successor_private.certificate'::regclass AND NOT tgisinternal)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='hotels_shadow_successor_private.certificate'::regclass
  AND tgname='immutable' AND tgenabled='O' AND tgfoid='hotels_shadow_successor_private.immutable()'::regprocedure)
 THEN RAISE EXCEPTION 'hotels_114482_certificate_security_drift'; END IF;
 IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
 WHERE oid='hotels_shadow_successor_private.catalog()'::regprocedure)
 IS DISTINCT FROM c->'hotels_shadow_successor_private.catalog()'->>'source'
 THEN RAISE EXCEPTION 'hotels_114482_source_security_drift'; END IF;
 IF c IS DISTINCT FROM hotels_shadow_successor_private.catalog()
 THEN RAISE EXCEPTION 'hotels_114482_source_security_drift'; END IF;
END $f$;

-- One authoritative current row, with audit-chain verification whenever the
-- lifecycle stage exists. Historical standalone H2B1 has no lifecycle receipts.
CREATE FUNCTION hotels_shadow_successor_private.flags() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE s jsonb;
BEGIN
 IF (SELECT count(*) FROM public.site_settings)<>1 THEN RAISE EXCEPTION 'hotels_114482_flags_invalid'; END IF;
 SELECT jsonb_build_object('hotel_rooms_v2_enabled',hotel_rooms_v2_enabled,
 'hotel_external_sync_enabled',hotel_external_sync_enabled,'hotel_instant_booking_enabled',hotel_instant_booking_enabled,
 'hotel_stripe_connect_enabled',hotel_stripe_connect_enabled) INTO s FROM public.site_settings WHERE id=1;
 IF s IS NULL OR EXISTS(SELECT 1 FROM jsonb_each(s) e WHERE jsonb_typeof(e.value)<>'boolean')
 THEN RAISE EXCEPTION 'hotels_114482_flags_invalid'; END IF;
 IF to_regprocedure('hotels_lifecycle_private.safe_state()') IS NOT NULL THEN
  IF s IS DISTINCT FROM hotels_lifecycle_private.safe_state()->'feature_flags'
  OR hotels_lifecycle_private.public_booking_enabled() IS NOT FALSE
  THEN RAISE EXCEPTION 'hotels_114482_flags_invalid'; END IF;
 END IF;
 RETURN s;
END $f$;

CREATE FUNCTION hotels_shadow_successor_private.state(p_hotel_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $f$
DECLARE
 h constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
 flags jsonb; result text:='BLOCKED'; reason text:='preparation_state_not_exact'; exact boolean:=false;
BEGIN
 IF p_hotel_id IS DISTINCT FROM h THEN RAISE EXCEPTION USING errcode='22023',message='hotels_114482_exact_hotel_required'; END IF;
 IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc
 WHERE oid='hotels_shadow_successor_private.assert_exact()'::regprocedure) IS DISTINCT FROM
 (SELECT functions->'hotels_shadow_successor_private.assert_exact()'->>'source' FROM hotels_shadow_successor_private.certificate WHERE id=1)
 THEN RAISE EXCEPTION 'hotels_114482_source_security_drift'; END IF;
 PERFORM hotels_shadow_successor_private.assert_exact();
 flags:=hotels_shadow_successor_private.flags();
 IF flags->'hotel_rooms_v2_enabled' IS DISTINCT FROM 'false'::jsonb THEN
  reason:='hotels_v2_h2b1_capability_flag_enabled';
 ELSIF flags->'hotel_instant_booking_enabled' IS DISTINCT FROM 'false'::jsonb
 OR flags->'hotel_stripe_connect_enabled' IS DISTINCT FROM 'false'::jsonb THEN
  reason:='unsupported_preparation_capability_state';
 ELSIF to_regclass('public.hotel_seven_arches_independent_pricing_authority') IS NOT NULL THEN
  -- Never interpret partial successor data as an earlier preparation state.
  PERFORM hotels_stripe_dto_private.assert_exact();
  SELECT count(*)=2 AND bool_and(r.inventory_mode='pooled' AND r.base_inventory_count=1
   AND r.max_occupancy=4 AND r.status='active'
   AND ((r.id='b4ef504f-cdeb-4e3c-a54d-932146ef4e94' AND r.code='upper-floor-apartment' AND r.legacy_source_key='upper_floor_apartment')
     OR (r.id='825c01b7-9f82-492a-9c81-9b1d5cd7acd3' AND r.code='ground-floor-apartment' AND r.legacy_source_key='ground_floor_apartment')))
   INTO exact FROM public.hotel_room_types r WHERE r.hotel_id=h;
  IF exact IS TRUE
   AND EXISTS(SELECT 1 FROM public.hotels WHERE id=h AND architecture_version='legacy')
   AND (SELECT count(*) FROM public.hotel_room_rates WHERE hotel_id=h)=2
   AND (SELECT count(*) FROM public.hotel_room_rates r JOIN (VALUES
    ('7e420964-9cbf-4f1b-abd3-09840af5240f'::uuid,'b4ef504f-cdeb-4e3c-a54d-932146ef4e94'::uuid,'aec20731-7a56-35f0-334e-92b363351f02'::uuid),
    ('3320590d-632d-423f-80d0-fd021cba7293','825c01b7-9f82-492a-9c81-9b1d5cd7acd3','9d109336-64f3-3c57-4684-968b59c94c3b')) e(rate_id,room_id,schedule_id)
    ON r.id=e.rate_id AND r.room_type_id=e.room_id AND r.pricing_schedule_id=e.schedule_id
    JOIN public.hotel_pricing_schedules s ON s.id=e.schedule_id AND s.hotel_id=h AND s.sharing_mode='independent'
    JOIN public.hotel_rate_plans p ON p.id=r.rate_plan_id AND p.hotel_id=h AND p.is_active AND p.review_status='reviewed'
    WHERE r.hotel_id=h AND r.rate_plan_id='22e47a63-a630-4fb6-8f43-816f2d3fdc17'
    AND r.is_active AND r.review_status='reviewed' AND r.currency='EUR' AND s.currency='EUR' AND s.is_active AND s.review_status='reviewed'
    AND (SELECT count(*) FROM public.hotel_pricing_schedule_occupancy_tiers t WHERE t.schedule_id=s.id AND t.is_active)=27)=2
   AND (SELECT count(*) FROM public.hotel_seven_arches_independent_pricing_authority WHERE hotel_id=h)=54
   AND EXISTS(SELECT 1 FROM public.hotel_commission_policies WHERE hotel_id=h AND commission_mode='per_allocated_room_per_night'
    AND amount=10 AND currency='EUR' AND is_active AND review_status='reviewed')
   AND hotels_lineage_private.current_anchor_is_exact() IS TRUE
   AND public.hotel_v2_seven_arches_independent_pricing_topology_is_exact() IS TRUE
   AND public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact() IS TRUE
   AND public.hotel_v2_seven_arches_pricing_activation_current_is_safe() IS TRUE
   AND public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS TRUE
  THEN result:='SUCCESSOR_ALREADY_COMPLETE'; reason:=NULL;
  ELSE reason:='successor_topology_or_protected_contract_not_exact'; END IF;
 ELSIF to_regnamespace('hotels_lineage_private') IS NOT NULL
  OR to_regclass('public.hotel_seven_arches_pricing_activation_evolution_receipts') IS NOT NULL THEN
  reason:='successor_authority_missing';
 ELSE
  -- Strict pristine historical state only; review-time content/version checks
  -- remain in the exact original writer body. Existing partial graphs are not
  -- recreated, flattened, downgraded or treated as empty.
  IF NOT EXISTS(SELECT 1 FROM public.hotel_room_types WHERE hotel_id=h)
   AND NOT EXISTS(SELECT 1 FROM public.hotel_room_rates WHERE hotel_id=h)
   AND NOT EXISTS(SELECT 1 FROM public.hotel_rate_plans WHERE hotel_id=h)
   AND NOT EXISTS(SELECT 1 FROM public.hotel_pricing_schedules WHERE hotel_id=h)
   AND EXISTS(SELECT 1 FROM public.hotels WHERE id=h AND architecture_version='legacy'
    AND public.hotel_v2_h2b1_children_policy_valid(children_policy,minimum_child_age,false)
    AND pricing_model='tiered_by_nights' AND max_persons=8 AND jsonb_typeof(photos)='array' AND jsonb_array_length(photos)=9
    AND description->>'en' LIKE '%All apartments are air-conditioned%'
    AND description->>'en' LIKE '%accepts children from 10 years old%'
    AND description->>'en' LIKE '%For bookings above 4 people%2 apartments%'
    AND amenities @> '["air_conditioning","terrace","balcony"]'::jsonb
    AND pricing_tiers->>'currency'='EUR' AND jsonb_typeof(pricing_tiers->'rules')='array'
    AND jsonb_array_length(pricing_tiers->'rules')=63)
  THEN result:='PRE_H2B1_READY';reason:=NULL; END IF;
 END IF;
 RETURN jsonb_build_object('contract_version','hotels_shadow_preparation_state_v1','hotel_id',h,'status',result,
 'reasons',CASE WHEN reason IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(reason) END,
 'room_type_ids',jsonb_build_array('b4ef504f-cdeb-4e3c-a54d-932146ef4e94','825c01b7-9f82-492a-9c81-9b1d5cd7acd3'),
 'feature_flags',flags,'public_booking_enabled',false,'mutation_allowed',result='PRE_H2B1_READY');
END $f$;

CREATE FUNCTION public.hotel_v2_admin_get_shadow_preparation_state(p_hotel_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $f$
BEGIN
 PERFORM public.hotel_v2_h2a_require_admin();
 IF auth.uid() IS NULL THEN RAISE EXCEPTION USING errcode='42501',message='hotels_114482_admin_required'; END IF;
 PERFORM hotels_shadow_successor_private.assert_exact();
 RETURN hotels_shadow_successor_private.state(p_hotel_id);
END $f$;

-- Clone the exact pinned historical body into a PRIVATE successor entry. The
-- sole body change is its capability check; every pricing/stale/identity guard
-- is retained byte-for-byte. The immutable historical public RPC is untouched.
DO $clone$ DECLARE d text; old text; replacement text; BEGIN
 d:=pg_get_functiondef('public.hotel_v2_admin_prepare_legacy_shadow_rooms(jsonb,uuid)'::regprocedure);
 old:=$old$if exists(select 1 from public.site_settings where id=1 and (hotel_rooms_v2_enabled
    or hotel_external_sync_enabled or hotel_instant_booking_enabled or hotel_stripe_connect_enabled)) then$old$;
 replacement:=$new$if (hotels_shadow_successor_private.flags()->'hotel_rooms_v2_enabled') IS DISTINCT FROM 'false'::jsonb then$new$;
 IF (length(d)-length(replace(d,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'hotels_114482_clone_mismatch'; END IF;
 d:=replace(d,'public.hotel_v2_admin_prepare_legacy_shadow_rooms(', 'hotels_shadow_successor_private.prepare_historical(');
 EXECUTE replace(d,old,replacement);
END $clone$;

CREATE FUNCTION public.hotel_v2_admin_prepare_shadow_rooms_successor(p_plan jsonb,p_correlation_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,auth AS $f$
DECLARE s jsonb;
BEGIN
 PERFORM public.hotel_v2_h2a_require_admin();
 IF auth.uid() IS NULL THEN RAISE EXCEPTION USING errcode='42501',message='hotels_114482_admin_required'; END IF;
 -- Serializes capability decisions and reviewed property edits. No new locks
 -- are used by the read-only Get. The historical writer keeps its own lock set.
 PERFORM 1 FROM public.site_settings WHERE id=1 FOR UPDATE;
 PERFORM 1 FROM public.hotels WHERE id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' FOR UPDATE;
 PERFORM hotels_shadow_successor_private.assert_exact();
 s:=hotels_shadow_successor_private.state((p_plan->>'hotel_id')::uuid);
 IF s->>'status'='SUCCESSOR_ALREADY_COMPLETE' THEN
  RAISE EXCEPTION USING errcode='55000',message='hotels_114482_preparation_already_complete';
 ELSIF s->>'status'<>'PRE_H2B1_READY' THEN
  RAISE EXCEPTION USING errcode='55000',message=coalesce(s->'reasons'->>0,'hotels_114482_preparation_blocked');
 END IF;
 RETURN hotels_shadow_successor_private.prepare_historical(p_plan,p_correlation_id);
END $f$;

DO $security$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='hotels_shadow_successor_private' OR p.oid IN(
 'public.hotel_v2_admin_get_shadow_preparation_state(uuid)'::regprocedure,
 'public.hotel_v2_admin_prepare_shadow_rooms_successor(jsonb,uuid)'::regprocedure) LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO postgres',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 END LOOP;
END $security$;
GRANT EXECUTE ON FUNCTION public.hotel_v2_admin_get_shadow_preparation_state(uuid),
 public.hotel_v2_admin_prepare_shadow_rooms_successor(jsonb,uuid) TO authenticated;
INSERT INTO hotels_shadow_successor_private.certificate VALUES
 (1,hotels_shadow_successor_private.catalog(),hotels_stripe_dto_private.business_hash());
DO $post$ BEGIN
 IF hotels_shadow_successor_private.state('9b6d99a0-923a-4fbc-be54-c066e856e6ca')->>'status'
 IS DISTINCT FROM 'SUCCESSOR_ALREADY_COMPLETE'
 OR hotels_stripe_dto_private.business_hash() IS DISTINCT FROM current_setting('hotels_114482.business_before')
 THEN RAISE EXCEPTION 'hotels_114482_postcondition_failed'; END IF;
END $post$;
NOTIFY pgrst,'reload schema';
COMMIT;
