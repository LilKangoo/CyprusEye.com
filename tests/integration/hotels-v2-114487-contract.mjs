import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const path='supabase/migrations/20260811448700_hotels_v2_admin_post_stripe_content_read_successor.sql';
export const rpc='public.hotel_v2_admin_get_content_control_114487';
export const hash=s=>createHash('sha256').update(s).digest('hex');
export const migration=readFileSync(new URL('../../'+path,import.meta.url),'utf8');
export const source=migration.split('AS $function$')[1].split('$function$;')[0];
test('114487 frozen predecessors retain exact accepted file identities',()=>{
 for(const [file,sha]of [
  ['20260811448500_hotels_v2_admin_content_read_successor.sql','8c8475ce00ab0ad0145d0b95a17d0914da6c0ac335c0ae0eec0e7fd6d6834fa3'],
  ['20260811448600_hotels_v2_stripe_platform_readiness_admin.sql','1d3eb08d1a7ba37e68ebc1a89e266fff48f4c5bc3be0468066a3f66e0f3f3636'],
 ]) assert.equal(hash(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url))),sha,file);
});
test('114487 creates only one versioned READ RPC and never replaces writers',()=>{
 assert.equal((migration.match(/CREATE FUNCTION /g)||[]).length,1);
 assert.match(migration,/CREATE FUNCTION public\.hotel_v2_admin_get_content_control_114487\(p_hotel_id uuid\)/);
 assert.doesNotMatch(migration,/CREATE OR REPLACE|\b(?:INSERT INTO|UPDATE public|DELETE FROM|DROP |TRUNCATE |LOCK TABLE)\b/i);
 assert.doesNotMatch(source,/\b(?:preview|submit|apply|set_capability|set_partner_stripe|attest_stripe)\w*\s*\(/i);
 assert.match(migration,/version='20260811448600'/);
 assert.match(migration,/version>'20260811448600'/);
 assert.match(migration,/to_regprocedure\('public\.hotel_v2_admin_get_content_control_114487\(uuid\)'\) IS NOT NULL/);
});
test('114487 exact STABLE, security-definer authenticated-only source/security postcondition',()=>{
 assert.match(migration,/RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER\nSET search_path=pg_catalog,public,auth/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.hotel_v2_admin_get_content_control_114487\(uuid\) FROM PUBLIC,anon,authenticated,service_role/);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public\.hotel_v2_admin_get_content_control_114487\(uuid\) TO authenticated/);
 assert.ok(migration.includes(hash(source)),'new RPC source hash must be derived from exact final body');
 assert.match(migration,/aclexplode\(coalesce\(p.proacl,acldefault/);
 assert.match(migration,/bool_and\(coalesce\(/,'nullable metadata must fail closed per row');
 assert.match(migration,/a\.grantor.*a\.privilege_type,a\.is_grantable/);
});
test('114487 uses audited lifecycle with exact post-Stripe flags; no false substitution',()=>{
 assert.match(source,/perform public\.hotel_v2_h2a_require_admin\(\)/);
 assert.match(source,/p_hotel_id is null/);
 assert.match(source,/p_hotel_id<>'9b6d99a0-923a-4fbc-be54-c066e856e6ca'::uuid/);
 assert.match(source,/v_lifecycle:=hotels_lifecycle_private\.safe_state\(\)/);
 assert.match(source,/"hotel_rooms_v2_enabled":true,"hotel_external_sync_enabled":true,"hotel_instant_booking_enabled":false,"hotel_stripe_connect_enabled":true/);
 for(const field of ['public_booking_enabled','expected_public_change','audit_chain_exact','architecture']) assert.ok(source.includes("v_lifecycle->"+(field==='architecture'?'>':'')+"'"+field+"'"));
 assert.match(source,/v_assignment_snapshot:=public\.hotel_v2_admin_get_partner_hotel_permissions\(p_hotel_id\)/);
 assert.match(source,/'feature_flags',v_assignment_snapshot->'feature_flags'/);
 assert.match(source,/hotels_v2_admin_b_content_control_v1/);
 assert.doesNotMatch(source,/predecessor_flag_exact|set_config|UPDATE |INSERT |DELETE /i);
});
test('114487 installation proves complete business hash unchanged and protected state safe',()=>{
 assert.match(migration,/set_config\('hotels_114487\.business_before',hotels_stripe_dto_private\.business_hash\(\),true\)/);
 assert.match(migration,/business_hash\(\) IS DISTINCT FROM current_setting\('hotels_114487\.business_before'\)/);
 assert.match(migration,/hotel_v2_seven_arches_pricing_activation_current_is_safe\(\) IS NOT TRUE/);
 assert.match(migration,/hotel_v2_seven_arches_payment_policy_lineage_is_exact\(\) IS NOT TRUE/);
 assert.match(migration,/^BEGIN;$/m);assert.match(migration,/COMMIT;\s*$/);
});
