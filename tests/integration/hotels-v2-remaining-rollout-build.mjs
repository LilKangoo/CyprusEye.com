// Deterministic offline builder. Catalog expectations are from exact committed
// migrations installed in a separate disposable synthetic catalog fixture.
// Data expectations below are reviewed constants, never learned from production.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {build as baselineBuild} from './hotels-v2-114425-rollout-build.mjs';
import {stages,migration,stageTables,compactFunctionQuery,relationQuery,schemaSecurityExpression,literal,array} from './hotels-v2-remaining-rollout-contract.mjs';
export function build(stage,phase,catalogs){
 assert.ok(stages.includes(stage));assert.ok(['preaction','postinstall'].includes(phase));
 const post=phase==='postinstall',physical=post?stage:([114425,...stages][stages.indexOf(stage)]);
 // Explicitly exclude the test-only timestamp trigger, never a production prerequisite.
 const productionCatalog=c=>({...c,functions:c.functions.filter(f=>f.signature!=='hotels_h2a_fixture_updated_at()')});
 const catalog=productionCatalog(catalogs[physical]),base=productionCatalog(catalogs[114425]);
 assert.equal(catalog.stage,physical);const m=migration(stage);
 const changes=new Map();for(const f of base.functions){const next=catalog.functions.find(n=>n.signature===f.signature);assert.ok(next,f.signature);if(next.source_sha!==f.source_sha)changes.set(f.source_sha,next.source_sha);}
 const evolve=q=>q.replace(/[0-9a-f]{64}/g,h=>changes.get(h)||h);
 const specs=baselineBuild('postinstall').specs.filter(s=>!(s.section==='future'&&Number(s.name.slice(0,6))<=physical)).map(s=>({...s,query:evolve(s.query)}));
 for(const s of specs){
  if(s.name.startsWith('recorded_'))s.expected=Number(s.name.slice(9))<stage?'1':'0';
  if(s.name==='successor_certificates_absent'){s.name='successor_certificate_count_exact';s.expected=physical>=114480?'2':physical>=114450?'1':'0';}
 }
 const add=(section,name,expression,relations=[],functions=[],expected='true')=>specs.push({section,name,expected,requirements:array(relations)+','+array(functions),query:'SELECT ('+expression+')::text AS actual'});
 const safe=(signature,expression=signature+' IS TRUE')=>add('stage_current_safe',signature,expression,[],[signature]);
 for(const s of stages.filter(s=>s<=physical)){
  for(const table of stageTables[s]){
   assert.ok(catalog.relations[table]);const expected=catalog.relations[table];
   assert.equal(expected.security.owner,'postgres');assert.equal(expected.security.rls,s!==114450);assert.equal(expected.security.force,s!==114450);assert.deepEqual(expected.security.nonowner_acl,[]);assert.equal(expected.security.effective,false);
   add('stage_relation_catalog',table,`(${relationQuery(table)}) IS NOT DISTINCT FROM ${literal(JSON.stringify(expected))}::jsonb AND ${schemaSecurityExpression(table.split('.')[0])}`);
   // Installation creates only the documented foundation/adapter receipts.
   const count=table.endsWith('provider_evolution_receipts')||table==='hotels_lifecycle_private.foundation'?1:table==='hotels_lifecycle_private.bindings'?catalog.lifecycle_binding_count:0;
   assert.ok(Number.isInteger(count));add('stage_install_rows',table+'_count',`(SELECT count(*) FROM ${table})`,[table],[],String(count));
  }
 }
 if(physical>=114450){
  safe('public.hotel_v2_external_calendar_provider_evolution_is_safe()');
  safe('public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()');
  safe('hotels_v2_private.hotel_external_calendar_provider_review_chain_is_exact()');
  safe('public.hotel_v2_external_calendar_provider_protected_fingerprints()','public.hotel_v2_external_calendar_provider_protected_fingerprints() IS NOT NULL');
 }
 if(physical>=114470){
  add('stripe_authorization','no_automatic_partner_authorization',`NOT EXISTS(SELECT 1 FROM hotel_stripe_connect_private.onboarding_authorizations)`,['hotel_stripe_connect_private.onboarding_authorizations']);
 }
 if(physical>=114480){
  safe('hotels_lifecycle_private.safe_state()',`hotels_lifecycle_private.safe_state() @> '{"version":0,"public_booking_enabled":false,"architecture":"legacy","expected_public_change":false,"audit_chain_exact":true}'::jsonb`);
  safe('hotels_lifecycle_private.public_booking_enabled()','hotels_lifecycle_private.public_booking_enabled() IS FALSE');
  add('lifecycle','historical_receipts_unchanged',`hotels_lifecycle_private.predecessor_receipts() IS NOT DISTINCT FROM (SELECT predecessor_receipts FROM hotels_lifecycle_private.foundation WHERE id=1)`,['hotels_lifecycle_private.foundation'],['hotels_lifecycle_private.predecessor_receipts()']);
 }
 const tuples=specs.map((s,i)=>` (${i+1},${literal(s.section)},${literal(s.name)},${literal(s.expected)},\n ${s.requirements},\n $check${i+1}$${s.query}$check${i+1}$)`).join(',\n');
 const fnValues=catalog.functions.map(f=>` (${literal(f.signature)},${literal(f.catalog_sha)})`).join(',\n');
 const n=specs.length+catalog.functions.length+1,ready=post?'POSTINSTALL_READY':'PREACTION_READY';
 const sql=`BEGIN;
SET TRANSACTION READ ONLY;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL search_path=pg_catalog,public;
-- Final successor ${stage} ${phase}; checkpoint f8fe3765a431246adae09c8fc30418ba5cd86371.
-- Exact migration SHA256 ${m.sha}; ${m.lines} lines; migration is NOT executed here.
-- Current stage remains UNRECORDED, including postinstall-before-repair.
-- Expected rows: ${n+1} (${n} required leaves and one summary).
-- Fixed SELECT-only queries. No timeout override, write lock, DDL, DML, or mutation RPC.
-- Function identities below are inspected, never invoked by the catalog scan.
-- Numeric result metadata only; no accounts, users, tokens, plans, secrets or provider URLs.
-- Backup is an EXTERNAL human gate: 09 Sep 2026 05:37:22 UTC; COMPLETED; PHYSICAL.
WITH expected_functions(signature,catalog_sha) AS (VALUES
${fnValues}
), actual_functions AS MATERIALIZED (
 SELECT f->>'signature' signature,f->>'catalog_sha' catalog_sha FROM jsonb_array_elements((${compactFunctionQuery})) f
), function_results AS MATERIALIZED (
 SELECT e.signature,a.catalog_sha IS NOT NULL AND a.catalog_sha=e.catalog_sha AS exact
 FROM expected_functions e LEFT JOIN actual_functions a USING(signature)
), catalog_guard AS MATERIALIZED (
 SELECT NOT EXISTS(SELECT 1 FROM function_results WHERE exact IS NOT TRUE)
 AND NOT EXISTS(SELECT 1 FROM actual_functions a LEFT JOIN expected_functions e USING(signature) WHERE e.signature IS NULL) AS exact
), specs(ordinal,section,leaf_name,expected,required_relations,required_functions,read_query) AS (VALUES
${tuples}
), eligibility AS MATERIALIZED (
 SELECT s.*,NOT EXISTS(SELECT 1 FROM unnest(required_relations) r(name) WHERE to_regclass(r.name) IS NULL)
 AND NOT EXISTS(SELECT 1 FROM unnest(required_functions) f(signature) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(f.signature) WHERE p.oid IS NULL OR p.provolatile NOT IN('s','i') OR p.proowner<>'postgres'::regrole)
 AND (cardinality(required_functions)=0 OR (SELECT exact FROM catalog_guard)) AS eligible FROM specs s
), measurements AS MATERIALIZED (
 SELECT e.*,CASE WHEN eligible THEN (xpath('/table/row/actual/text()',query_to_xml(read_query,true,false,'')))[1]::text ELSE NULL END actual FROM eligibility e
), leaves AS MATERIALIZED (
 SELECT ordinal,section,leaf_name,expected,actual,eligible AND actual IS NOT NULL AND actual=expected pass FROM measurements
 UNION ALL SELECT ${specs.length}+row_number() OVER(ORDER BY signature)::integer,'source_security',signature,'true',exact::text,exact IS TRUE FROM function_results
 UNION ALL SELECT ${n},'source_security','complete_function_universe_exact','true',exact::text,exact IS TRUE FROM catalog_guard
), totals AS (
 SELECT bool_and(pass IS TRUE) ready,coalesce(jsonb_agg(leaf_name ORDER BY ordinal) FILTER(WHERE pass IS NOT TRUE),'[]'::jsonb) blockers,count(*) required_count,count(*) FILTER(WHERE pass IS TRUE) passed_count FROM leaves
)
SELECT section,ordinal,leaf_name,expected,actual,pass,NULL::boolean AS "${ready}",NULL::jsonb blocker_codes,NULL::bigint required_leaf_count,NULL::bigint passed_leaf_count FROM leaves
UNION ALL SELECT 'final_gate',${n+1},'${ready}','true',ready::text,ready,ready,blockers,required_count,passed_count FROM totals ORDER BY ordinal;
ROLLBACK;
`;
 return {sql,specs,rows:n+1,leaves:n,catalog,physical};
}
export function loadCatalogs(){return JSON.parse(readFileSync('tests/integration/hotels-v2-remaining-rollout-catalog.json','utf8'));}
