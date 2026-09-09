// Offline builder: retain the accepted 114420 boundary and derive the new seam
// exclusively from committed 114425 source. No connection or SQL execution.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {hash,literal,array} from './hotels-v2-114420-postinstall-contract.mjs';
export const migrationPath='supabase/migrations/20260811442500_hotels_v2_external_calendar_site_settings_compatibility.sql';
export const migrationSha='d72c244840bd21a5c5e7e46f654c8b3a7466f80f1d18ebac3ca938ab43163ee5';
export const signature='public.hotel_v2_external_calendar_site_settings_fingerprint()';
export const functionName='hotel_v2_external_calendar_site_settings_fingerprint';
const migration=readFileSync(migrationPath,'utf8');assert.equal(hash(migration),migrationSha);
export const sourceHash=hash(migration.split('$function$')[1]);
assert.equal(sourceHash,'e297f1b640f544644d695b36b4aca0b2dc90385e83709e8a494044aabc3b95bd');
const baseline=readFileSync('supabase/manual/hotels_v2_114420_postinstall_readonly.sql','utf8');
assert.equal(hash(baseline),'7fd15e2faf1e71649aa694a42c2ac516adbdca44267f982ed045460a777c51e1');
const legacy=readFileSync('supabase/manual/hotels_v2_external_calendar_site_settings_compatibility_preflight.sql','utf8');
assert.equal(hash(legacy),'ccfecd9c3611723ec243ca4ff402b109ca638494f7d5985d06e8e4ffad08a3bc');
export const expectedExpression=migration.match(/v_expected text:=(public\.hotel_v2_external_calendar_worker_hash\([\s\S]*?\));/)[1];
const guards=[...legacy.matchAll(/^  if ([\s\S]*?) then\n    raise exception using errcode='[^']+',\n      message='([^']+)'/gm)];
assert.equal(guards.length,9);
export function build(stage){
 assert.ok(['preaction','postinstall'].includes(stage));const post=stage==='postinstall';
 const specs=[...baseline.matchAll(/\((\d+),'([^']+)','([^']+)','([^']+)',\n\s*([^\n]+),\n\s*\$check\1\$([\s\S]*?)\$check\1\$/g)].map(m=>({section:m[2],name:m[3],expected:m[4],requirements:m[5],query:m[6]}));
 assert.equal(specs.length,120);
 specs.find(s=>s.name==='recorded_114420').expected='1';
 specs.splice(specs.findIndex(s=>s.name==='114425_helper_absent'),1);
 const add=(section,name,expression,relations=[],functions=[])=>specs.push({section,name,expected:'true',requirements:array(relations)+','+array(functions),query:'SELECT ('+expression+')::text AS actual'});
 add('session','repeatable_read_exact',"current_setting('transaction_isolation')='repeatable read'");
 add('114425_collision','no_relation_or_type_name_collision',`NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='${functionName}') AND NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='${functionName}')`);
 add('114425_collision','function_name_cardinality_exact',`(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${functionName}')=${post?1:0}`);
 // Preserve every legacy readiness guard except helper absence, checked above
 // by the complete name/collision set. Convert RAISE conditions to fail-closed
 // scalar leaves, not a DO block. No expected value is relaxed.
 for(const [,condition,name] of guards){
  if(name.endsWith('boundary_mismatch'))continue;
  const leaf=name.replace('hotels_v2_external_calendar_site_settings_preflight_','').replace(/_mismatch$/,'_exact').replace(/_missing$/,'_present').replace('unsupported_hotels_lifecycle','supported_hotels_lifecycle').replace('expected_fingerprint_null','expected_fingerprint_present');
  add('114425_prerequisite',leaf,'NOT coalesce(('+condition.replaceAll('v_expected','('+expectedExpression+')')+'),true)',
   name.endsWith('foundation_missing')?[]:['public.site_settings','hotels_v2_private.hotel_external_calendar_activation_receipts'],
   /current_stage2f_lineage|expected_fingerprint_null/.test(name)?['public.hotel_v2_partner_workspace_function_lineage_is_exact()','public.hotel_v2_external_calendar_worker_hash(jsonb)']:[]);
 }
 let pins=baseline.slice(baseline.indexOf('pins(signature,'),baseline.indexOf('specs(ordinal,'));
 if(post){
  pins=pins.replace('\n),\npin_results',`,\n  (${literal(signature)},${literal(sourceHash)},'s',true,ARRAY['search_path=pg_catalog, public']::text[],false)\n),\npin_results`);
  add('114425_function','function_identity_security_source_exact',`EXISTS(SELECT 1 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure('${signature}') AND p.pronargs=0 AND p.proargnames IS NULL AND pg_get_function_identity_arguments(p.oid)='' AND pg_get_function_result(p.oid)='text' AND l.lanname='plpgsql' AND p.proowner='postgres'::regrole AND p.provolatile='s' AND p.prosecdef AND p.prokind='f' AND NOT p.proisstrict AND NOT p.proretset AND NOT p.proleakproof AND p.proparallel='u' AND p.proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[] AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='${sourceHash}' AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee<>p.proowner) AND has_function_privilege('postgres',p.oid,'EXECUTE') AND NOT has_function_privilege(0::oid,p.oid,'EXECUTE') AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE') AND NOT has_function_privilege('service_role',p.oid,'EXECUTE'))`);
  add('114425_behavior','canonical_lifecycle_fingerprint_exact',`${signature} IS NOT NULL AND ${signature} IS NOT DISTINCT FROM (${expectedExpression}) AND (${expectedExpression})='9d385718586ec03664878d35552e73373bd2e4dca170dc497025fc6780c79bf5'`,['public.site_settings','hotels_v2_private.hotel_external_calendar_activation_receipts'],[signature,'public.hotel_v2_external_calendar_worker_hash(jsonb)']);
 }
 const pinCount=post?15:14,count=specs.length+pinCount,ready=post?'POSTINSTALL_READY':'PREACTION_READY';
 const tuples=specs.map((s,i)=>`  (${i+1},${literal(s.section)},${literal(s.name)},${literal(s.expected)},\n    ${s.requirements},\n    $check${i+1}$${s.query}$check${i+1}$)`).join(',\n');
 let tail=baseline.slice(baseline.indexOf('eligibility AS MATERIALIZED'));
 tail=tail.replace('SELECT 120+row_number()','SELECT '+specs.length+'+row_number()').replaceAll('POSTINSTALL_READY',ready).replace("SELECT 'final_gate',135,","SELECT 'final_gate',"+(count+1)+',').replace('PHYSICAL_POSTINSTALL_BEFORE_REPAIR; NOT_WRITE_AUTHORIZATION; SQL_BACKUP_PROOF=NO',(post?'114425_PHYSICAL_POSTINSTALL_BEFORE_REPAIR':'114425_PREACTION_ONLY')+'; NOT_WRITE_AUTHORIZATION; SQL_BACKUP_PROOF=NO');
 const sql=`BEGIN;\nSET TRANSACTION READ ONLY;\nSET TRANSACTION ISOLATION LEVEL REPEATABLE READ;\nSET LOCAL search_path=pg_catalog,public;\n-- Final successor 114425 ${stage}; accepted base c081653a7806651f5d5f06c704420bb976652030.\n-- Migration SHA256 ${migrationSha}; 306 lines; migration unchanged.\n-- 114416 and 114420 recorded; 114425 and all later stages unrecorded.\n-- Expected rows: ${count+1} (${count} required leaves and one summary).\n-- Derived from exact 114420 postinstall catalogs plus every 114425 readiness guard.\n-- Source-pinned two-state fingerprint helper excludes unrelated settings; flags here remain f/t/f/f.\n-- Fixed SELECT-only queries; inspected Preview/Submit signatures are NEVER called.\n-- No timeout override, mutation RPC, DDL/DML or explicit write lock.\n-- Human recovery: 09 Sep 2026 05:37:22 UTC; COMPLETED; PHYSICAL; Restore available.\n-- SQL does not establish backups or authorize any production write.\nWITH\n${pins}specs(ordinal,section,leaf_name,expected,required_relations,required_functions,read_query) AS (\n VALUES\n${tuples}\n),\n${tail}`;
 assert.ok(sql.endsWith('ROLLBACK;\n'));return {sql,specs,pinCount,leaves:count,rows:count+1};
}
if(process.argv[2])process.stdout.write(build(process.argv[2]).sql);
