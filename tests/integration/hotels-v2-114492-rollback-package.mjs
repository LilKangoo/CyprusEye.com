// Generates a rollback-only certificate. Does not connect to any database.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {migration,sha} from './hotels-v2-114492-contract.mjs';
const hash=sha(migration);
assert.equal((migration.match(/^BEGIN;/gm)||[]).length,1);
assert.equal((migration.match(/^COMMIT;/gm)||[]).length,1);
const body=migration.replace(/^BEGIN;\n/m,'').replace(/^COMMIT;\s*$/m,'');
assert.ok(!body.includes('$candidate492$'));
const snapshot=`jsonb_build_object(
 'business',hotels_stripe_dto_private.business_hash(),
 'lifecycle',hotels_post_114489_private.safe_state_114490(),
 'catalog',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(
 p.oid,p.prosrc,p.proacl,p.proconfig,p.proowner,p.prosecdef,p.provolatile,p.proisstrict,p.proleakproof,p.proretset,p.prolang)
 ORDER BY p.oid),'[]'::jsonb)::text,'UTF8')),'hex') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema')),
 'schemas',(SELECT jsonb_agg(jsonb_build_array(oid,nspname,nspowner,nspacl) ORDER BY oid) FROM pg_namespace),
 'ledger',(SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations),
 'foundation',(SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'UTF8')),'hex') FROM hotels_published_architecture_private.foundation_certificate t),
 'receipt',(SELECT encode(sha256(convert_to(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'UTF8')),'hex') FROM hotels_published_architecture_private.conversion_receipt t),
 'property_history',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]'::jsonb)::text,'UTF8')),'hex') FROM hotels_published_architecture_private.property_history t),
 'absent',to_regprocedure('public.hotel_v2_partner_get_workspace_114492(uuid,uuid,date,date)') IS NULL)`;
const cert=`PERFORM hotels_published_architecture_private.assert_receipt_exact();
 IF r5k_catalog_proof.payment_catalog_is_exact() IS DISTINCT FROM true
 OR hotels_post_114489_private.calendar_provider_lineage_bridge_114490() IS DISTINCT FROM true
 THEN RAISE EXCEPTION '114492_historical_certificate_failure'; END IF;`;
const sql=`-- ROLLBACK ONLY. Project daoohnbnnowmmcizgvrq. No permanent installation.
-- Exact candidate SHA256: ${hash}
-- Local frozen file SHA: 114489=60e735d7d3d53a32f0391ca0aa8ca0f464dc9edaabde568a0fc8070833c59832
-- 114490=738c88d341e49826c1451413c2db768840230d4d394acd2b94b8f4f00debf81a
-- 114491=5a424b8955408a643dcada4a2b83823e91e150554d52ca45f9abe95ad384e53b
-- File SHA pins are independently checked by the generator's static gate;
-- production boundary is checked through ledger, exact sources and receipts.
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s';
DO $cert492$
DECLARE
 v_before jsonb;v_after jsonb;v_dto jsonb;v_permission jsonb;v_expected_stripe jsonb;
 v_actor uuid;v_other uuid;v_ok boolean:=false;v_denied boolean;v_assignment uuid;
 v_started timestamptz;v_elapsed numeric;v_keys text[];
 v_partner constant uuid:='0a321bfe-da6b-43f6-8e0b-7c68546a8b18';
 v_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION '114492_requires_postgres'; END IF;
 IF to_regprocedure('public.hotel_v2_partner_get_workspace_114492(uuid,uuid,date,date)') IS NOT NULL
 OR (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version IN ('20260811448900','20260811449000','20260811449100'))<>3
 OR (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure('public.hotel_v2_partner_list_assigned_properties_114491(uuid)'))
 IS DISTINCT FROM '4f1d27311f87a59bcfb31b1857531b9af7115758626c43845e86e7311e97e32d'
 THEN RAISE EXCEPTION '114492_cert_boundary'; END IF;
 ${cert}
 SELECT ${snapshot} INTO v_before;
 IF v_before->>'business' IS NULL THEN RAISE EXCEPTION '114492_business_baseline_missing'; END IF;
 SELECT pu.user_id INTO v_actor FROM public.partner_users pu JOIN public.partners p ON p.id=pu.partner_id
 WHERE pu.partner_id=v_partner AND pu.role='owner' AND p.status='active' AND p.can_manage_hotels ORDER BY pu.id LIMIT 1;
 SELECT p.id INTO v_other FROM public.partners p WHERE p.id<>v_partner
 AND NOT EXISTS(SELECT 1 FROM public.partner_users pu WHERE pu.partner_id=p.id AND pu.user_id=v_actor) ORDER BY p.id LIMIT 1;
 SELECT id INTO STRICT v_assignment FROM public.partner_resources WHERE partner_id=v_partner AND resource_id=v_hotel AND resource_type='hotels';
 IF v_actor IS NULL OR v_other IS NULL THEN RAISE EXCEPTION '114492_probe_identity_missing'; END IF;
 v_permission:=public.hotel_v2_h3_2a_permissions_snapshot(v_assignment);
 SELECT jsonb_build_object('authorized',(hotel_stripe_connect_private.authorization_state(v_partner)->>'enabled')::boolean,
 'status',coalesce((SELECT status FROM hotel_stripe_connect_private.accounts WHERE partner_id=v_partner),'NOT_CONNECTED')) INTO v_expected_stripe;
 BEGIN
  EXECUTE $candidate492$
${body}
$candidate492$;
  ${cert}
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  PERFORM set_config('role','authenticated',true);
  v_started:=clock_timestamp();
  v_dto:=public.hotel_v2_partner_get_workspace_114492(v_partner,v_hotel,current_date,current_date+1);
  v_elapsed:=extract(epoch FROM clock_timestamp()-v_started)*1000;
  SELECT array_agg(k ORDER BY k) INTO v_keys FROM jsonb_object_keys(v_dto) k;
  IF v_keys IS DISTINCT FROM (SELECT array_agg(k ORDER BY k) FROM unnest(ARRAY[
   'contract_version','partner','hotel_id','assignment','feature_flags','content_snapshot_token','property','property_draft',
   'rooms','units','pricing','availability','sections','recent_activity','legacy_authoritative','public_change',
   'architecture_successor','capability_lifecycle','stripe_connection']) k)
  OR v_dto->>'contract_version' IS DISTINCT FROM 'hotels_v2_h3_2b_partner_workspace_114492_v1'
  OR v_dto->'partner' IS DISTINCT FROM jsonb_build_object('id',v_partner,'role','owner')
  OR v_dto->>'hotel_id' IS DISTINCT FROM v_hotel::text
  OR v_dto#>>'{assignment,id}' IS DISTINCT FROM v_assignment::text
  OR v_dto#>'{assignment,permission_version}' IS DISTINCT FROM v_permission->'version'
  OR v_dto#>'{assignment,capabilities}' IS DISTINCT FROM v_permission->'capabilities'
  OR v_dto#>>'{property,architecture_version}' IS DISTINCT FROM 'rooms_v2'
  OR v_dto#>'{property,is_published}' IS DISTINCT FROM 'true'::jsonb
  OR v_dto->'public_change' IS DISTINCT FROM 'false'::jsonb
  OR v_dto->'legacy_authoritative' IS DISTINCT FROM 'false'::jsonb
  OR v_dto->'capability_lifecycle' IS DISTINCT FROM v_before->'lifecycle'
  OR v_dto->'feature_flags' IS DISTINCT FROM v_before#>'{lifecycle,feature_flags}'
  OR v_dto#>'{architecture_successor,conversion_receipt_present}' IS DISTINCT FROM 'true'::jsonb
  OR v_dto#>'{architecture_successor,public_booking_enabled}' IS DISTINCT FROM 'false'::jsonb
  THEN RAISE EXCEPTION '114492_workspace_dto_identity'; END IF;
  IF jsonb_typeof(v_dto->'pricing') IS DISTINCT FROM 'object'
  OR jsonb_typeof(v_dto->'availability') IS DISTINCT FROM 'object'
  OR jsonb_typeof(v_dto->'property_draft') IS DISTINCT FROM 'object'
  OR jsonb_array_length(v_dto#>'{pricing,room_rate_tiers}')<>0
  OR (SELECT count(*)
      FROM jsonb_array_elements(v_dto#>'{pricing,schedule_tiers}') t
      WHERE t->>'schedule_id' IN (
        SELECT r->>'pricing_schedule_id'
        FROM jsonb_array_elements(v_dto#>'{pricing,room_rates}') r
      ))<>54
  OR jsonb_array_length(v_dto#>'{pricing,room_rates}')<>2
  OR jsonb_array_length(v_dto->'rooms')<>2
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_dto#>'{pricing,room_rates}') r
    WHERE r->>'hotel_id'<>v_hotel::text
      OR r->>'pricing_source' IS DISTINCT FROM 'pricing_schedule'
      OR NULLIF(r->>'pricing_schedule_id','') IS NULL
      OR NOT EXISTS(
        SELECT 1
        FROM jsonb_array_elements(v_dto#>'{pricing,schedules}') s
        WHERE s->>'id'=r->>'pricing_schedule_id'
      )
      OR (SELECT count(*)
          FROM jsonb_array_elements(v_dto#>'{pricing,schedule_tiers}') t
          WHERE t->>'schedule_id'=r->>'pricing_schedule_id')<>27)
  OR v_dto#>>'{availability,hotel_id}' IS DISTINCT FROM v_hotel::text
  OR v_dto#>>'{availability,contract_version}' IS DISTINCT FROM 'hotels_v2_admin_d_availability_control_v1'
  OR v_dto#>>'{availability,property,architecture_version}' IS DISTINCT FROM 'rooms_v2'
  OR v_dto#>'{availability,public_change}' IS DISTINCT FROM 'false'::jsonb
  OR v_dto#>>'{pricing,commission_policy,commission_mode}' IS DISTINCT FROM 'per_allocated_room_per_night'
  OR v_dto#>'{pricing,commission_policy,amount}' IS DISTINCT FROM '10'::jsonb
  OR v_dto#>>'{pricing,commission_policy,currency}' IS DISTINCT FROM 'EUR'
  OR v_dto#>'{stripe_connection,onboarding_authorized}' IS DISTINCT FROM v_expected_stripe->'authorized'
  OR v_dto#>'{stripe_connection,account_status}' IS DISTINCT FROM v_expected_stripe->'status'
  OR v_dto#>'{stripe_connection,platform_enabled}' IS DISTINCT FROM 'true'::jsonb
  OR v_dto::text ~ '"(customer_email|customer_name|customer_phone|guest_email|guest_phone|access_token|refresh_token|secret_key|ical_url)"[[:space:]]*:'
  THEN RAISE EXCEPTION '114492_workspace_projection'; END IF;
  v_denied:=false;
  BEGIN PERFORM public.hotel_v2_partner_get_workspace_114492(v_other,v_hotel,current_date,current_date+1);
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION '114492_cross_partner_not_denied'; END IF;
  PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
  v_denied:=false;
  BEGIN PERFORM public.hotel_v2_partner_get_workspace_114492(v_partner,v_hotel,current_date,current_date+1);
  EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION '114492_unauthorized_not_denied'; END IF;
  PERFORM set_config('role','postgres',true);
  IF hotels_stripe_dto_private.business_hash() IS DISTINCT FROM v_before->>'business'
  THEN RAISE EXCEPTION '114492_business_mutation'; END IF;
  ${cert}
  v_ok:=true;
  RAISE EXCEPTION USING ERRCODE='P1492',MESSAGE='intentional_114492_rollback';
 EXCEPTION WHEN SQLSTATE 'P1492' THEN
  IF NOT v_ok OR SQLERRM<>'intentional_114492_rollback' THEN RAISE; END IF;
 END;
 SELECT ${snapshot} INTO v_after;
 IF v_after IS DISTINCT FROM v_before THEN RAISE EXCEPTION '114492_after_rollback_mismatch'; END IF;
 ${cert}
 PERFORM set_config('hotels_114492.certification',jsonb_build_object(
 'sentinel','HOTELS_114492_ROLLBACK_CERT_OK','candidate_sha','${hash}',
 'full_workspace',true,'pricing_present',true,'availability_present',true,'stripe_exact',true,
 'authority_rows',54,'upper_ground_tiers','27/27','commission_unchanged',true,'public_booking',false,
 'catalog_drift_absent',true,'legacy_rejection_absent',true,'unauthorized_denied',true,'cross_partner_denied',true,
 'historical_receipts_exact',true,'before_equals_after',true,'successor_absent',true,'persisted_mutation',false,
 'workspace_elapsed_ms',v_elapsed)::text,true);
END $cert492$;
SELECT current_setting('hotels_114492.certification')::jsonb AS certification;
ROLLBACK;
`;
const output=process.argv[2];
assert.ok(output && path.isAbsolute(output)
 && path.basename(output)==='hotels-114492-rollback-certification.sql'
 && !output.includes('/supabase/'));
writeFileSync(output,sql);
console.log(JSON.stringify({file:output,candidate_sha:hash,certificate_sha:sha(sql),lines:sql.split('\n').length-1,production_executed:false}));
