\set ON_ERROR_STOP on
BEGIN;
DO $gate$
DECLARE mutation text; rejected boolean; failures integer:=0; before_state jsonb; after_state jsonb;
BEGIN
 IF current_database() !~ '^hotels_functional_global_' OR host(inet_server_addr())<>'127.0.0.1'
 OR inet_server_port()<>55479 THEN RAISE EXCEPTION 'local_lifecycle_fixture_required'; END IF;
 before_state:=hotels_lifecycle_private.safe_state();
 FOREACH mutation IN ARRAY ARRAY[
 'GRANT SELECT ON hotels_lifecycle_private.decisions TO authenticated',
 'GRANT INSERT ON hotels_lifecycle_private.context TO service_role',
 'GRANT EXECUTE ON FUNCTION hotels_lifecycle_private.safe_state() TO PUBLIC',
 'ALTER FUNCTION hotels_lifecycle_private.safe_state() OWNER TO authenticated',
 'GRANT EXECUTE ON FUNCTION public.hotel_v2_admin_get_capability_lifecycle() TO authenticated WITH GRANT OPTION',
 'REVOKE EXECUTE ON FUNCTION public.hotel_v2_admin_get_capability_lifecycle() FROM authenticated',
 'CREATE OR REPLACE FUNCTION hotels_lifecycle_private.public_booking_enabled() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS ''SELECT true''',
 'ALTER FUNCTION hotels_lifecycle_private.safe_state() SECURITY INVOKER',
 'ALTER FUNCTION hotels_lifecycle_private.safe_state() SET search_path=public',
 'ALTER TABLE hotels_lifecycle_private.decisions DISABLE ROW LEVEL SECURITY',
 'ALTER TABLE hotels_lifecycle_private.decisions NO FORCE ROW LEVEL SECURITY',
 'ALTER TABLE hotels_lifecycle_private.decisions DISABLE TRIGGER lifecycle_decision_immutable',
 'CREATE POLICY unexpected ON hotels_lifecycle_private.decisions USING(true)',
 'GRANT SELECT ON hotel_stripe_connect_private.accounts TO anon',
 'ALTER TABLE hotels_lifecycle_private.stripe_readiness ALTER checked_at SET DEFAULT ''infinity''::timestamptz',
 'ALTER TABLE hotels_lifecycle_private.decisions ALTER created_at SET DEFAULT ''2000-01-01''::timestamptz',
 'ALTER FUNCTION public.hotel_v2_admin_set_partner_stripe_onboarding_authorization(uuid,boolean,bigint,uuid,text) SECURITY INVOKER',
 'ALTER FUNCTION public.hotel_v2_admin_set_capability_lifecycle(text,boolean,bigint,uuid,text,text) SET statement_timeout=''0'''
 ] LOOP
  rejected:=false;
  BEGIN
   EXECUTE mutation;
   PERFORM hotels_lifecycle_private.chain_state();
   RAISE EXCEPTION USING message='NEGATIVE_WAS_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM='NEGATIVE_WAS_ACCEPTED' THEN RAISE; END IF;
   IF SQLERRM<>'hotels_lifecycle_catalog_drift' THEN RAISE; END IF;
   rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'missing negative rejection'; END IF;
  failures:=failures+1;
  after_state:=hotels_lifecycle_private.safe_state();
  IF before_state IS DISTINCT FROM after_state THEN RAISE EXCEPTION 'negative rollback state leak'; END IF;
 END LOOP;
 FOREACH mutation IN ARRAY ARRAY[
 'UPDATE public.site_settings SET hotel_rooms_v2_enabled=NOT hotel_rooms_v2_enabled WHERE id=1',
 'UPDATE public.site_settings SET hotel_stripe_connect_enabled=NOT hotel_stripe_connect_enabled WHERE id=1',
 'UPDATE public.site_settings SET hotel_instant_booking_enabled=true WHERE id=1',
 'UPDATE public.site_settings SET hotel_external_sync_enabled=NOT hotel_external_sync_enabled WHERE id=1',
 'UPDATE hotels_lifecycle_private.foundation SET initial_flags=''{}''',
 'DELETE FROM hotels_lifecycle_private.foundation',
 'TRUNCATE hotels_lifecycle_private.decisions',
 'TRUNCATE hotels_lifecycle_private.bindings'
 ] LOOP
  BEGIN
   EXECUTE mutation;
   RAISE EXCEPTION 'NEGATIVE_WAS_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT IN ('hotels_lifecycle_explicit_admin_transition_required','hotels_lifecycle_immutable_receipt') THEN RAISE; END IF;
  END;
  failures:=failures+1;
  IF before_state IS DISTINCT FROM hotels_lifecycle_private.safe_state() THEN RAISE EXCEPTION 'raw DML rollback leak'; END IF;
 END LOOP;
 IF failures<>26 THEN RAISE EXCEPTION 'negative cardinality'; END IF;
 IF public.hotel_v2_external_calendar_provider_evolution_is_safe() IS NOT TRUE
 OR public.hotel_v2_seven_arches_payment_policy_lineage_is_exact() IS NOT TRUE
 OR EXISTS(SELECT 1 FROM hotels_lifecycle_private.context) THEN RAISE EXCEPTION 'containment failed'; END IF;
 RAISE NOTICE 'HOTELS_CAPABILITY_SECURITY_PASS negatives=26 rollback=exact';
END $gate$;
ROLLBACK;
