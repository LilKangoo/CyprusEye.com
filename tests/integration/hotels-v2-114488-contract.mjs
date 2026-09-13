import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hash,mask,schema,legacy,successor,migrationPath,evidenceRoots,exactMetadata} from './hotels-v2-114488-read-compiler.mjs';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const migration=read(migrationPath);
const compiler=read('tests/integration/hotels-v2-114488-read-compiler.mjs');
const unquote=value=>value.slice(1,-1).replaceAll("''","'");
// Inspect the committed generated artifact, not a machine-local catalog or fixture.
const statements=[...migration.matchAll(/^ EXECUTE ('(?:''|[^'])*');$/gm)].map(match=>unquote(match[1]));
const functions=statements.filter(sql=>sql.startsWith('CREATE FUNCTION ')).map(sql=>{
 const match=sql.match(/^CREATE FUNCTION ([\w.]+)\((.*?)\) RETURNS ([\w.]+) LANGUAGE (\w+) STABLE SECURITY DEFINER ([\s\S]*?) AS ('(?:''|[^'])*');\nALTER FUNCTION /);
 assert.ok(match,'every new function has an inspectable explicit body/security declaration');
 return {name:match[1],args:match[2],ret:match[3],language:match[4],settings:match[5],source:unquote(match[6]),sql};
});
const rpc=functions.find(fn=>fn.name===successor);
const clones=functions.filter(fn=>fn.name.startsWith(schema+'.read_'));
const guard=functions.find(fn=>fn.name===schema+'.assert_exact');
const originalMigration=read('supabase/migrations/20260811442000_hotels_v2_seven_arches_application_pricing_bridge.sql');
const originalMatch=originalMigration.match(/create function public\.hotel_v2_partner_get_seven_arches_reviewed_pricing\([\s\S]*?as \$function\$([\s\S]*?)\$function\$;/i);
assert.ok(originalMatch,'frozen legacy source found exactly');
const original=originalMatch[1];
const predecessorArray=migration.match(/FOR b IN SELECT value FROM jsonb_array_elements\(('(?:''|[^'])*')::jsonb\) LOOP/);
assert.ok(predecessorArray,'pre-install exact source/security manifest exists');
const predecessors=JSON.parse(unquote(predecessorArray[1]));
const cached=[...rpc.source.matchAll(/SELECT p_read_context\|\|jsonb_build_object\('([^']+)',jsonb_build_object\('is_null',value IS NULL,'value',value\)\)/g)].map(match=>match[1]);

test('114488 freezes accepted 114485/114486/114487 migration bytes',()=>{
 for(const [name,expected] of [
  ['20260811448500_hotels_v2_admin_content_read_successor.sql','8c8475ce00ab0ad0145d0b95a17d0914da6c0ac335c0ae0eec0e7fd6d6834fa3'],
  ['20260811448600_hotels_v2_stripe_platform_readiness_admin.sql','1d3eb08d1a7ba37e68ebc1a89e266fff48f4c5bc3be0468066a3f66e0f3f3636'],
  ['20260811448700_hotels_v2_admin_post_stripe_content_read_successor.sql','100a08e49222f5645906dbbdf85dbbd2ac72cb2172d21fe76f7774e9c9c6e2b5'],
 ]) assert.equal(hash(read('supabase/migrations/'+name)),expected,name);
});

test('114488 pins but never replaces the exact legacy RPC',()=>{
 assert.equal(hash(original),'55e5ffc18a938051f6c819d873b66adcb8ad48f02dbd5854ebe8dc0b16642a4e');
 const pin=predecessors.find(row=>row.signature===legacy+'(uuid, uuid)');
 assert.ok(pin);assert.equal(pin.meta[0],hash(original));
 assert.equal(pin.meta[1],'bcb0d3d618efbb8584dc95156ffda03f9af6a6ea332a78aab30b2c2de16adf5a');
 assert.equal(functions.filter(fn=>fn.name.startsWith('public.')).length,1);
 assert.equal(functions.find(fn=>fn.name.startsWith('public.')).name,successor);
 assert.doesNotMatch(migration,/CREATE OR REPLACE/i);
});

test('114488 exact boundary is recorded 114487 with no later local Hotels stage',()=>{
 assert.match(migration,/^BEGIN;$/m);
 assert.match(migration,/SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;/);
 assert.match(migration,/version='20260811448700'/);
 assert.match(migration,/version ~ '\^20260811\[0-9\]\{6\}\$' AND version>'20260811448700'/);
 assert.ok(migration.includes("to_regnamespace('"+schema+"') IS NOT NULL"));
 assert.ok(migration.includes("to_regprocedure('"+successor+"(uuid, uuid)') IS NOT NULL"));
 assert.match(migration,/COMMIT;\s*$/);
});

test('114488 installation creates only new read functions/private schema, never state or writers',()=>{
 assert.equal(statements.length,24);
 assert.equal(functions.length,21);
 assert.equal(clones.length,18);
 assert.deepEqual(statements.filter(sql=>!sql.startsWith('CREATE FUNCTION ')),[
  'CREATE SCHEMA '+schema+' AUTHORIZATION postgres',
  'REVOKE ALL ON SCHEMA '+schema+' FROM PUBLIC,anon,authenticated,service_role',
  'GRANT EXECUTE ON FUNCTION '+successor+'(uuid, uuid) TO authenticated;',
 ]);
 for(const fn of functions){
  assert.doesNotMatch(mask(fn.source),/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|NOTIFY|LOCK)\b/i,fn.name);
  assert.doesNotMatch(mask(fn.source),/\b(?:set_config|pg_advisory_lock|pg_notify)\s*\(/i,fn.name);
  assert.doesNotMatch(mask(fn.source),/\b[\w.]*_(?:preview|submit|apply|authorize|connect|revoke)\w*\s*\(/i,fn.name);
  // Frozen helpers contain constant dynamic SELECTs for optional successor
  // relations. Inspect those too rather than confusing EXECUTE with mutation.
  const dynamic=[...fn.source.matchAll(/\bexecute\s+((?:'(?:''|[^'])*'|\$(\w*)\$[\s\S]*?\$\2\$)(?:\s*\|\|\s*'(?:''|[^'])*')*)\s+into\b/gi)];
  assert.equal(dynamic.length,(mask(fn.source).match(/\bEXECUTE\b/gi)||[]).length,fn.name+' has only constant inspectable dynamic SQL');
  for(const command of dynamic){
   const query=[...command[1].matchAll(/'(?:''|[^'])*'|\$(\w*)\$([\s\S]*?)\$\1\$/g)].map(token=>token[0][0]==="'"?unquote(token[0]):token[2]).join('');
   assert.match(query,/^\s*SELECT\b/i,fn.name);
   assert.doesNotMatch(mask(query),/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|NOTIFY|LOCK|EXECUTE)\b/i,fn.name);
  }
 }
 assert.doesNotMatch(compiler,/statement_timeout|lock_timeout/i);
 assert.doesNotMatch(statements.join('\n'),/\bCREATE\s+(?:TEMP\s+)?TABLE\b|\bALTER\s+(?:ROLE|DATABASE)\b/i);
});

test('114488 public RPC and all private helpers have exact protected security declarations',()=>{
 assert.equal(rpc.args,'p_partner_id uuid, p_hotel_id uuid');
 assert.equal(rpc.ret,'jsonb');assert.equal(rpc.language,'plpgsql');
 assert.equal(rpc.settings,'SET search_path=pg_catalog,public,auth');
 for(const fn of functions){
  assert.match(fn.sql,/ LANGUAGE (?:sql|plpgsql) STABLE SECURITY DEFINER /);
  assert.match(fn.settings,/SET search_path\s*(?:=|TO)/);
  assert.match(fn.sql,/ALTER FUNCTION [\s\S]* OWNER TO postgres;/);
  assert.match(fn.sql,/REVOKE ALL ON FUNCTION [\s\S]* FROM PUBLIC,anon,authenticated,service_role;$/);
 }
 assert.equal(statements.filter(sql=>/^GRANT EXECUTE/.test(sql)).length,1);
 assert.ok(guard.source.includes('a.grantee<>n.nspowner'));
 assert.ok(guard.source.includes('hotels_114488_private_security_drift'));
 assert.ok(rpc.source.includes('hotels_114488_guard_drift'));
 assert.ok(rpc.source.includes('PERFORM '+schema+'.assert_exact()'));
});

test('114488 full predecessor and clone metadata remains pinned with ordered exact ACL semantics',()=>{
 assert.ok(predecessors.length>63,'opaque branches are pinned as well as the optimized closure');
 for(const row of predecessors){
  assert.equal(row.meta.length,16,row.signature);
  assert.match(row.meta[0],/^[0-9a-f]{64}$/);assert.match(row.meta[1],/^[0-9a-f]{64}$/);
  assert.ok(['s','i','v'].includes(row.meta[5]),row.signature);
 }
 assert.ok(guard.source.includes('hotels_114488_predecessor_drift:'));
 assert.ok(guard.source.includes('hotels_114488_read_helper_drift:'));
 assert.ok(guard.source.includes('hotels_114488_helper_universe_drift'));
 assert.ok(exactMetadata.includes('ARRAY(SELECT entry::text FROM unnest(p.proacl)'));
 assert.ok(exactMetadata.includes('ORDER BY'));
 assert.ok(exactMetadata.includes('pg_get_function_arguments'));
 assert.ok(exactMetadata.includes('q.proparallel,q.prokind'));
});

test('114488 caches exactly 28 no-argument STABLE values with 18 source-span clones',()=>{
 assert.match(migration,/Pure-STABLE evidence closure: 63; once-only entries: 28; private clones: 18/);
 assert.equal(cached.length,28);assert.equal(new Set(cached).size,28);
 assert.equal((rpc.source.match(/WITH evaluated AS MATERIALIZED/g)||[]).length,28);
 for(const name of cached){
  const pin=predecessors.find(row=>row.signature===name+'()');
  assert.ok(pin,name);assert.equal(pin.meta[5],'s',name);assert.equal(pin.meta[12],'',name);
  assert.ok(['boolean','jsonb','text'].includes(pin.meta[13]),name);
 }
 assert.ok(!cached.includes('public.hotel_v2_h3_2b_flags_off'));
 assert.ok(!cached.includes('public.hotel_v2_7a_reviewed_pricing_property_lineage_is_exact'));
 for(const name of evidenceRoots)assert.ok(cached.includes(name));
 assert.ok(compiler.includes("'VOLATILE evidence boundary'"));
 assert.ok(compiler.includes("'time/session evidence boundary'"));
});

test('114488 opaque access, workspace/VOLATILE descendants and commission remain original calls',()=>{
 const start='  v_access:=';const end='  v_state:=';
 assert.equal(rpc.source.slice(rpc.source.indexOf(start),rpc.source.indexOf(end)),original.slice(original.indexOf(start),original.indexOf(end)));
 const policy='  v_policy:=public.hotel_v2_h3_2b_commission_policy(p_hotel_id);';
 assert.ok(rpc.source.includes(policy));
 assert.equal((rpc.source.match(/public\.hotel_v2_h3_2b_access_snapshot\(/g)||[]).length,1);
 assert.equal((rpc.source.match(/public\.hotel_v2_partner_get_workspace\(/g)||[]).length,1);
 assert.equal((rpc.source.match(/public\.hotel_v2_h3_2b_commission_policy\(/g)||[]).length,1);
 for(const name of ['public.hotel_v2_h3_2b_access_snapshot','public.hotel_v2_partner_get_workspace','public.hotel_v2_h3_2b_commission_policy'])assert.ok(!cached.includes(name));
 assert.ok(!rpc.source.includes('hotel_v2_admin_d_snapshot('));
 assert.ok(!rpc.source.includes('hotel_v2_admin_c_enforce_graph_limits('));
});

test('114488 entire DTO construction, exact scoped proposal filter and snapshot tokens are unchanged',()=>{
 const marker='  return jsonb_build_object(';
 assert.equal(rpc.source.slice(rpc.source.indexOf(marker)).trimEnd(),original.slice(original.indexOf(marker)).trimEnd());
 assert.ok(rpc.source.includes("'pricing_snapshot_token',v_workspace#>>'{pricing,snapshot_token}'"));
 assert.ok(rpc.source.includes("'evolution_snapshot_token',v_state->>'snapshot_token'"));
 assert.ok(rpc.source.includes('where proposal.partner_id=p_partner_id'));
 assert.ok(rpc.source.includes("and proposal.assignment_id=(v_access->>'assignment_id')::uuid"));
});

test('114488 source mask preserves offsets and excludes quoted hashes, names and comments',()=>{
 const executable='public.example_read()';
 const samples=["'public.example_read()'", "'public.example_read(''quoted'')'", '$tag$public.example_read()$tag$', '$$public.example_read()$$', '-- public.example_read()', '/* public.example_read() */'];
 for(const quoted of samples){
  const text=quoted+'\n'+executable;const code=mask(text);
  assert.equal(code.length,text.length);
  assert.equal(code.indexOf(executable),text.lastIndexOf(executable));
  assert.equal((code.match(/public\.example_read\(/g)||[]).length,1);
 }
 assert.equal(mask('SELECT $1, $2;'),'SELECT $1, $2;','positional params stay visible to rejection guard');
 assert.ok(compiler.includes("'positional parameter needs explicit mapping'"));
 assert.ok(compiler.includes('assert.ok(start+length<=last)'));
});

test('114488 void assertions remain callable and retain fail-closed RAISE paths, not cached values',()=>{
 const assertions=clones.filter(fn=>fn.ret==='void');assert.equal(assertions.length,2);
 for(const fn of assertions){
  assert.equal(fn.args,'p_read_context jsonb');
  assert.match(fn.source,/RAISE EXCEPTION/i,fn.name);
  assert.match(fn.source,/SELECT \* INTO STRICT/i,fn.name);
  assert.ok(clones.some(other=>other.name!==fn.name&&other.source.includes(fn.name+'(p_read_context)')),fn.name+' is still invoked');
 }
 assert.ok(!cached.some(name=>name.endsWith('.assert_exact')));
 assert.match(rpc.source,/EXCEPTION WHEN OTHERS THEN[\s\S]*RAISE EXCEPTION USING errcode='55000',message='hotels_v2_seven_arches_reviewed_pricing_control_unavailable'/);
 assert.doesNotMatch(mask(rpc.source),/WHEN\s+(?:query_canceled|sqlstate\s*'57014')/i);
});

test('114488 invocation context distinguishes SQL NULL from JSON null and never caches by truthiness',()=>{
 assert.match(rpc.source,/declare p_read_context jsonb:='\{\}'::jsonb;/i);
 assert.equal((rpc.source.match(/'is_null',value IS NULL,'value',value/g)||[]).length,28);
 const allBodies=functions.map(fn=>fn.source).join('\n');
 for(const type of ['jsonb','boolean','text'])assert.ok(allBodies.includes('THEN NULL::'+type+' ELSE'));
 assert.match(allBodies,/ELSE p_read_context#>ARRAY\['[^']+','value'\] END/);
 assert.match(allBodies,/ELSE \(p_read_context#>>ARRAY\['[^']+','value'\]\)::boolean END/);
 assert.doesNotMatch(allBodies,/coalesce\(p_read_context/i);
 const sqlNull={is_null:true,value:null};const jsonNull={is_null:false,value:null};
 assert.notDeepEqual(sqlNull,jsonNull,'the SQL context representation explicitly retains null kind');
 assert.ok(!compiler.includes("cached=ordered.filter(p=>p.vol==='v'"));
});

test('114488 installation compares current business evidence before/after without storing a cache',()=>{
 assert.match(migration,/DECLARE business_before text; b jsonb;/);
 assert.match(migration,/business_before:=hotels_stripe_dto_private\.business_hash\(\);/);
 assert.match(migration,/business_hash\(\) IS DISTINCT FROM business_before/);
 assert.match(migration,/hotel_v2_seven_arches_independent_pricing_topology_is_exact\(\) IS NOT TRUE/);
 assert.match(migration,/hotel_v2_seven_arches_payment_policy_lineage_is_exact\(\) IS NOT TRUE/);
 assert.ok(!statements.some(sql=>/\b(?:TABLE|TRIGGER|VIEW|INDEX|POLICY)\b/i.test(mask(sql))));
 assert.doesNotMatch(mask(rpc.source),/\b(?:current_setting|set_config)\s*\(/i);
});
