import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const migrationPath='supabase/migrations/20260811449200_hotels_v2_post_conversion_partner_workspace_successor.sql';
export const migration=readFileSync(migrationPath,'utf8');
export const evidence=JSON.parse(readFileSync('tests/integration/fixtures/hotels-v2-114492-production-read-contract.json','utf8'));
export const certificateClosure=JSON.parse(readFileSync('tests/integration/fixtures/hotels-v2-114492-certificate-closure.json','utf8'));
export const sha=s=>createHash('sha256').update(s).digest('hex');
export const functions=[...migration.matchAll(/CREATE FUNCTION ([\w.]+)\(([^\n]*)\) RETURNS (\w+)\nLANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,auth,pg_temp AS \$function\$([\s\S]*?)\$function\$;/g)].map(m=>({name:m[1],args:m[2],returns:m[3],body:m[4],ddl:m[0]}));
let checks=0;
const pass=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const original=n=>evidence.originals.find(f=>f.signature.startsWith(n+'(')).source;
const body=n=>functions.find(f=>f.name.endsWith(n)).body;
pass('116 complete read/certificate dependencies pinned before and after installation',()=>{
 assert.equal(certificateClosure.count,116);assert.equal(certificateClosure.functions.length,116);
 assert.equal(new Set(certificateClosure.functions.map(f=>f.signature)).size,116);
 const pinSets=[...migration.matchAll(/\$pins\$([\s\S]*?)\$pins\$::jsonb/g)].map(m=>JSON.parse(m[1]));
 assert.equal(pinSets.length,2);
 for(const f of certificateClosure.functions){
  for(const pins of pinSets){const matches=pins.filter(p=>p.signature===f.signature);assert.equal(matches.length,1);assert.equal(matches[0].prosrc_sha,f.prosrc_sha);assert.equal(matches[0].definition_sha,f.definition_sha);assert.deepEqual(matches[0].acl,f.acl);assert.deepEqual(matches[0].config,f.config);}
  for(const d of f.dependencies)assert.ok(certificateClosure.functions.some(f=>f.signature===d),d);
 }
 assert.deepEqual(certificateClosure.dynamic_selects.map(f=>f.count),[5,3]);
 for(const f of certificateClosure.dynamic_selects)for(const s of f.literals)assert.match(s,/^\s*select\b/i);
});
pass('48 historical + 22 post-conversion dependencies closed and source pinned',()=>{
 assert.equal(evidence.historical_count,48);assert.equal(evidence.functions.length,70);
 for(const f of evidence.functions){assert.match(f.prosrc_sha,/^[a-f0-9]{64}$/);assert.ok(migration.includes(f.prosrc_sha));assert.equal(f.modification_allowed,false);
  for(const d of f.dependencies)assert.ok(evidence.functions.some(g=>g.signature===d));
  if(f.historical)assert.ok(f.protected_by.includes('114489.foundation_certificate'));
 }
 for(const f of evidence.originals)assert.equal(sha(f.source),f.prosrc_sha);
});
pass('exactly four additive functions; no historical replacement or nonexistent 114489 dependency',()=>{
 assert.equal(functions.length,4);assert.doesNotMatch(migration,/CREATE OR REPLACE FUNCTION|hotel_v2_partner_get_workspace_114489|\.architecture_evidence\(/);
});
pass('workspace projection preserves all historical fields and adds certified architecture evidence',()=>{
 let expected=original('public.hotel_v2_partner_get_workspace');
 for(const [a,b] of [
 ['public.hotel_v2_h3_2b_access_snapshot(','hotels_partner_workspace_114492_private.access_snapshot('],
 ['public.hotel_v2_admin_c_pricing_control_snapshot(','public.hotel_v2_admin_c_pricing_control_snapshot_114490('],
 ['public.hotel_v2_admin_d_snapshot(','public.hotel_v2_admin_d_snapshot_114490('],
 ['hotels_lifecycle_private.safe_state()','hotels_post_114489_private.safe_state_114490()'],
 ['hotels_lifecycle_private.partner_connection(','hotels_partner_workspace_114492_private.stripe_projection('],
 ['hotels_v2_h3_2b_partner_workspace_v1','hotels_v2_h3_2b_partner_workspace_114492_v1']])expected=expected.replace(a,b);
 expected=expected.replace("    'legacy_authoritative',v_hotel.architecture_version='legacy','public_change',false);",`    'architecture_successor',jsonb_build_object('contract_version','hotels_v2_published_architecture_v1',
      'hotel_id',v_hotel.id,'architecture_version',v_hotel.architecture_version,'is_published',v_hotel.is_published,
      'public_booking_enabled',hotels_post_114489_private.safe_state_114490()->'public_booking_enabled',
      'conversion_receipt_present',EXISTS(SELECT 1 FROM hotels_published_architecture_private.conversion_receipt WHERE hotel_id=v_hotel.id)),
    'legacy_authoritative',v_hotel.architecture_version='legacy','public_change',false);`);
 assert.equal(body('hotel_v2_partner_get_workspace_114492'),expected);
});
pass('no DML or dynamic execution in any runtime function',()=>{
 for(const f of functions){const code=f.body.replace(/--[^\n]*/g,'').replace(/'(?:[^']|'')*'/g,"''");assert.doesNotMatch(code,/\b(insert|update|delete|execute|notify|create|alter|drop|set_config|nextval)\b/i);}
});
pass('only target Partner/Hotel and certified published rooms_v2 permitted',()=>{
 assert.match(body('require_access'),/0a321bfe-da6b-43f6-8e0b-7c68546a8b18/);assert.match(body('require_access'),/9b6d99a0-923a-4fbc-be54-c066e856e6ca/);
 assert.match(body('access_snapshot'),/architecture_version='rooms_v2'/);assert.match(body('access_snapshot'),/is_published IS TRUE AND booking_mode='request_confirmation'/);
});
pass('membership owner/staff exact scope and all twelve permission branches preserved',()=>{
 const old=original('public.hotel_v2_h3_2a_require_partner_hotel_access');
 const security=old.slice(old.indexOf('  v_membership :='),old.indexOf('  if (select count(*) from public.site_settings)'));
 assert.ok(body('require_access').includes(security));
 assert.match(body('access_snapshot'),/public.hotel_v2_h3_2a_permissions_snapshot\(v_assignment\)/);
});
pass('Stripe preserves owner authorization, real account and readiness TTL presentation',()=>{
 const expected=original('hotels_lifecycle_private.partner_connection').replace('public.hotel_v2_h3_2a_require_partner_hotel_access(','hotels_partner_workspace_114492_private.require_access(').replace('hotels_lifecycle_private.safe_state()','hotels_post_114489_private.safe_state_114490()');
 assert.equal(body('stripe_projection'),expected);assert.doesNotMatch(body('stripe_projection'),/oauth|http_post|account_links/i);
});
pass('no stale lifecycle call or public Admin authorized RPC in runtime',()=>{
 for(const f of functions)assert.doesNotMatch(f.body,/hotels_lifecycle_private\.(safe_state|chain_state|predecessor_flag_exact|catalog_snapshot)\s*\(|public\.hotel_v2_admin_get_|public\.hotel_v2_admin_(preview|apply)_/);
 assert.match(body('hotel_v2_partner_get_workspace_114492'),/snapshot_114490\(p_hotel_id,p_from,p_to,false\)/);
});
pass('private schema inaccessible; only authenticated public successor EXECUTE',()=>{
 assert.match(migration,/REVOKE ALL ON SCHEMA hotels_partner_workspace_114492_private FROM PUBLIC,anon,authenticated,service_role/);
 assert.equal((migration.match(/^GRANT /gm)||[]).length,1);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION public.hotel_v2_partner_get_workspace_114492\(uuid,uuid,date,date\) TO authenticated/);
});
pass('114489/114490/114491 immutable migration freeze',()=>{
 for(const [file,hash] of [
 ['20260811448900_hotels_v2_published_rooms_v2_conversion.sql','60e735d7d3d53a32f0391ca0aa8ca0f464dc9edaabde568a0fc8070833c59832'],
 ['20260811449000_hotels_v2_post_conversion_admin_successors.sql','738c88d341e49826c1451413c2db768840230d4d394acd2b94b8f4f00debf81a'],
 ['20260811449100_hotels_v2_post_conversion_partner_read_successor.sql','5a424b8955408a643dcada4a2b83823e91e150554d52ca45f9abe95ad384e53b']])assert.equal(sha(readFileSync('supabase/migrations/'+file)),hash);
});
console.log(`114492_STATIC_CERTIFICATION=PASS checks=${checks} migration_sha=${sha(migration)}`);
