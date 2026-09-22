// Generate ONLY. Never connects to any database or executes the certificate.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const path='supabase/migrations/20260811449100_hotels_v2_post_conversion_partner_read_successor.sql';
const migration=readFileSync(path,'utf8');
const sha=createHash('sha256').update(migration).digest('hex');
assert.equal(sha,'5a424b8955408a643dcada4a2b83823e91e150554d52ca45f9abe95ad384e53b');
assert.equal((migration.match(/^BEGIN;/gm)||[]).length,1);
assert.equal((migration.match(/^COMMIT;/gm)||[]).length,1);
const body=migration.replace(/^BEGIN;\n/m,'').replace(/^COMMIT;\s*$/m,'');
assert.ok(!body.includes('$candidate_114491$'));
const snapshot=`jsonb_build_object(
 'business',hotels_stripe_dto_private.business_hash(),
 'lifecycle',hotels_post_114489_private.safe_state_114490(),
 'catalog',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(
   jsonb_build_array(p.oid,p.prosrc,p.proacl,p.proconfig,p.proowner,p.prosecdef,p.provolatile,p.proisstrict,p.proleakproof,p.proretset,p.prolang)
   ORDER BY p.oid),'[]'::jsonb)::text,'UTF8')),'hex')
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'),
 'ledger',(SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations),
 'new_rpc_absent',to_regprocedure('public.hotel_v2_partner_list_assigned_properties_114491(uuid)') IS NULL)`;
const certificates=`PERFORM hotels_published_architecture_private.assert_receipt_exact();
 IF r5k_catalog_proof.payment_catalog_is_exact() IS DISTINCT FROM true
 OR hotels_post_114489_private.calendar_provider_lineage_bridge_114490() IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'hotels_114491_historical_certificate_failure'; END IF;`;
const sql=`-- ROLLBACK-ONLY CERTIFICATION. Not an installation file.
-- Project daoohnbnnowmmcizgvrq. Exact candidate SHA256: ${sha}
-- The candidate body is executed unchanged (only its outer BEGIN/COMMIT are
-- removed). A deliberate P1491 exception rolls its entire subtransaction back.
-- The outer transaction also ends in ROLLBACK. No commit path exists.
-- Probes use transaction-local synthetic claims; no token or identity is output.
BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s';
DO $cert_114491$
DECLARE
 v_before jsonb; v_after jsonb; v_business text; v_safe jsonb; v_dto jsonb;
 v_actor uuid; v_other uuid; v_ok boolean:=false; v_denied boolean;
 v_partner constant uuid:='0a321bfe-da6b-43f6-8e0b-7c68546a8b18';
 v_hotel constant uuid:='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'hotels_114491_cert_requires_postgres'; END IF;
 IF to_regprocedure('public.hotel_v2_partner_list_assigned_properties_114491(uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'hotels_114491_successor_must_be_absent'; END IF;
 ${certificates}
 SELECT ${snapshot} INTO v_before;
 v_safe:=v_before->'lifecycle'; v_business:=v_before->>'business';
 IF v_business IS NULL OR v_safe->'feature_flags' IS DISTINCT FROM
 '{"hotel_rooms_v2_enabled":true,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":true}'::jsonb
 OR v_safe->'public_booking_enabled' IS DISTINCT FROM 'false'::jsonb
 OR v_safe->'expected_public_change' IS DISTINCT FROM 'false'::jsonb
 OR v_safe->'audit_chain_exact' IS DISTINCT FROM 'true'::jsonb
 THEN RAISE EXCEPTION 'hotels_114491_cert_boundary'; END IF;
 SELECT pu.user_id INTO v_actor FROM public.partner_users pu
 JOIN public.partners p ON p.id=pu.partner_id
 WHERE pu.partner_id=v_partner AND pu.role='owner' AND p.status='active' AND p.can_manage_hotels
 ORDER BY pu.id LIMIT 1;
 IF v_actor IS NULL THEN RAISE EXCEPTION 'hotels_114491_cert_no_authorized_owner'; END IF;
 SELECT p.id INTO v_other FROM public.partners p WHERE p.id<>v_partner
 AND NOT EXISTS(SELECT 1 FROM public.partner_users pu WHERE pu.partner_id=p.id AND pu.user_id=v_actor)
 ORDER BY p.id LIMIT 1;
 IF v_other IS NULL THEN RAISE EXCEPTION 'hotels_114491_cert_no_cross_partner_probe'; END IF;
 BEGIN
   EXECUTE $candidate_114491$
${body}
$candidate_114491$;
   ${certificates}
   PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
   PERFORM set_config('role','authenticated',true);
   v_dto:=public.hotel_v2_partner_list_assigned_properties_114491(v_partner);
   IF v_dto->>'contract_version' IS DISTINCT FROM 'hotels_v2_h3_2a_partner_permissions_v1'
    OR v_dto->'partner'->>'id' IS DISTINCT FROM v_partner::text
    OR v_dto->'partner'->>'role' IS DISTINCT FROM 'owner'
    OR (SELECT count(*) FROM jsonb_array_elements(v_dto->'properties') p
        WHERE p->>'hotel_id'=v_hotel::text AND p->>'assignment_id'='a082c085-a6ea-46fd-8548-c8d9c6ee2c34')<>1
   THEN RAISE EXCEPTION 'hotels_114491_cert_assignment_mismatch'; END IF;
   v_denied:=false;
   BEGIN
     PERFORM public.hotel_v2_partner_list_assigned_properties_114491(v_other);
   EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
   END;
   IF NOT v_denied THEN RAISE EXCEPTION 'hotels_114491_cross_partner_not_denied'; END IF;
   PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
   v_denied:=false;
   BEGIN
     PERFORM public.hotel_v2_partner_list_assigned_properties_114491(v_partner);
   EXCEPTION WHEN insufficient_privilege THEN v_denied:=true;
   END;
   IF NOT v_denied THEN RAISE EXCEPTION 'hotels_114491_unauthenticated_identity_not_denied'; END IF;
   PERFORM set_config('role','postgres',true);
   IF hotels_stripe_dto_private.business_hash() IS DISTINCT FROM v_business
    OR hotels_post_114489_private.safe_state_114490() IS DISTINCT FROM v_safe
   THEN RAISE EXCEPTION 'hotels_114491_probe_state_changed'; END IF;
   v_ok:=true;
   RAISE EXCEPTION USING ERRCODE='P1491',MESSAGE='intentional_candidate_rollback';
 EXCEPTION WHEN SQLSTATE 'P1491' THEN
   IF NOT v_ok THEN RAISE; END IF;
 END;
 -- Candidate creation, ACLs and all transaction-local probe settings have
 -- already been rolled back here, before comparing the complete baseline.
 SELECT ${snapshot} INTO v_after;
 IF v_after IS DISTINCT FROM v_before
 THEN RAISE EXCEPTION 'hotels_114491_post_rollback_state_changed'; END IF;
 ${certificates}
 PERFORM set_config('hotels_114491.cert_result',jsonb_build_object(
   'sentinel','HOTELS_114491_ROLLBACK_CERT_OK','candidate_sha','${sha}',
   'published_receipt_exact',true,'payment_catalog_exact',true,'calendar_bridge_exact',true,
   'safe_lifecycle_unchanged',true,'old_rpc_unchanged',true,'authorized_assignment_exact',true,
   'catalog_drift_absent',true,'unauthorized_denied',true,'cross_partner_denied',true,
   'post_rollback_state_identical',true,'successor_absent',true,'persisted_mutation',false)::text,true);
END
$cert_114491$;
SELECT current_setting('hotels_114491.cert_result')::jsonb AS certification;
ROLLBACK;
`;
const output=process.argv[2];
assert.ok(output?.startsWith('/private/tmp/')&&output.endsWith('.sql'),'Output must be an explicit /private/tmp SQL artifact');
writeFileSync(output,sql);
console.log('CERTIFICATION_FILE='+output);
console.log('CANDIDATE_SHA='+sha);
console.log('CERTIFICATION_SHA='+createHash('sha256').update(sql).digest('hex'));
console.log('CERTIFICATION_LINES='+(sql.match(/\n/g)||[]).length);
console.log('PRODUCTION_EXECUTED=NO');
