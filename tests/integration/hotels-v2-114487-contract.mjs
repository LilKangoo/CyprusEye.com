import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const path='supabase/migrations/20260811448700_hotels_v2_admin_post_stripe_content_read_successor.sql';
export const rpc='public.hotel_v2_admin_get_content_control_114487';
export const hash=s=>createHash('sha256').update(s).digest('hex');
export const migration=readFileSync(new URL('../../'+path,import.meta.url),'utf8');
export const source=migration.split('AS $function$')[1].split('$function$;')[0];
const permissionsSignature='hotel_v2_admin_get_partner_hotel_permissions(uuid)';
const permissionsSourceSha='5800d0f35b7b4f289353946177e07daee7f6ce050009d457ba5fbac4f585d2ab';
const permissionsCatalogSha='328994f274b80eec25d8e558915abf8f673ad560a459b54c99ef75682f41619e';
const permissionsMetadata={
 signature:permissionsSignature,identity_arguments:'p_hotel_id uuid',result:'jsonb',language:'plpgsql',
 volatility:'s',definer:true,owner:'postgres',configuration:['search_path=pg_catalog, public, auth'],
 strict:false,parallel:'u',leakproof:false,kind:'f',returns_set:false,source_sha:permissionsSourceSha,
 acl:[['authenticated','postgres','EXECUTE',false],['postgres','postgres','EXECUTE',false]],
 effective:[false,false,true,false],
};
// Reproduce PostgreSQL jsonb::text for this numeric-free, ASCII-key metadata only.
// This is not an alternative general-purpose JSON/numeric canonicalizer.
const metadataJsonbText=value=>{
 if(value===null)return 'null';
 if(Array.isArray(value))return '['+value.map(metadataJsonbText).join(', ')+']';
 if(typeof value==='object')return '{'+Object.keys(value)
  .sort((a,b)=>Buffer.byteLength(a)-Buffer.byteLength(b)||Buffer.compare(Buffer.from(a),Buffer.from(b)))
  .map(key=>JSON.stringify(key)+': '+metadataJsonbText(value[key])).join(', ')+'}';
 assert.ok(['string','boolean'].includes(typeof value),'catalog proof accepts no numeric normalization');
 return JSON.stringify(value);
};
test('114487 permissions predecessor source is the exact original 113200 body, not the catalog digest',()=>{
 const foundation=readFileSync(new URL('../../supabase/migrations/20260811320000_hotels_v2_h3_2a_partner_access_foundation.sql',import.meta.url),'utf8');
 const bodies=[...foundation.matchAll(/create function public\.hotel_v2_admin_get_partner_hotel_permissions\(p_hotel_id uuid\)[\s\S]*?as \$function\$([\s\S]*?)\$function\$;/gi)];
 assert.equal(bodies.length,1);
 assert.equal(Buffer.byteLength(bodies[0][1]),3098);
 assert.equal(hash(bodies[0][1]),permissionsSourceSha);
 assert.notEqual(hash(bodies[0][1]),permissionsCatalogSha);
});
test('114487 16-field source/security catalog independently reproduces the distinct 328994 digest',()=>{
 assert.equal(Object.keys(permissionsMetadata).length,16);
 assert.equal(hash(metadataJsonbText(permissionsMetadata)),permissionsCatalogSha);
 assert.notEqual(permissionsSourceSha,permissionsCatalogSha);
 const altered={...permissionsMetadata,acl:[...permissionsMetadata.acl,['anon','postgres','EXECUTE',false]]};
 assert.notEqual(hash(metadataJsonbText(altered)),permissionsCatalogSha,'real ACL drift remains distinct');
});
test('114487 lineage manuals use catalog_sha; failure-root records source and catalog as separate domains',()=>{
 for(const file of ['hotels_v2_114480_preaction_readonly.sql','hotels_v2_114480_postinstall_readonly.sql',
  'hotels_v2_admin_partner_completion_preactivation_readonly.sql','hotels_v2_admin_partner_completion_postactivation_readonly.sql']){
  const manual=readFileSync(new URL('../../supabase/manual/'+file,import.meta.url),'utf8');
  assert.match(manual,/WITH expected_functions\(signature,catalog_sha\) AS \(VALUES/,file);
  assert.ok(manual.includes(`('${permissionsSignature}','${permissionsCatalogSha}')`),file);
  assert.ok(manual.includes("'source_sha',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')"),file);
  assert.ok(manual.includes("'catalog_sha',encode(sha256(convert_to(f::text,'UTF8')),'hex')"),file);
  assert.ok(manual.includes('a.catalog_sha=e.catalog_sha'),file);
 }
 const diagnostic=readFileSync(new URL('../../supabase/manual/hotels_v2_114450_failure_root_diagnostic_readonly.sql',import.meta.url),'utf8');
 assert.match(diagnostic,/WITH expected_functions\(signature,source_sha,catalog_sha\) AS \(VALUES/);
 assert.ok(diagnostic.includes(`('${permissionsSignature}','${permissionsSourceSha}','${permissionsCatalogSha}')`));
 assert.ok(diagnostic.includes("encode(sha256(convert_to(a.metadata::text,'UTF8')),'hex') catalog_sha"));
 assert.ok(diagnostic.includes("a.metadata->>'source_sha' IS NOT DISTINCT FROM e.source_sha source_equal"));
});
test('114487 pre/post guards require only the canonical permissions prosrc, never its catalog hash',()=>{
 for(const tag of ['pre','post']){
  const block=migration.split(`DO $${tag}$`)[1].split(`END $${tag}$;`)[0];
  const pins=[...block.matchAll(/\('public\.hotel_v2_admin_get_partner_hotel_permissions\(uuid\)','([0-9a-f]{64})'/g)];
  assert.deepEqual(pins.map(match=>match[1]),[permissionsSourceSha],tag);
  assert.ok(block.includes("encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=e.source"),tag);
 }
 assert.ok(!migration.includes(permissionsCatalogSha),'catalog hash cannot be accepted as alternative source');
});
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
