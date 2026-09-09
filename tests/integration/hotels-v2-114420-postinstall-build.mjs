// Build only from committed-source-matched synthetic catalog evidence; never connect.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {tables,bookingColumns,functions,columnsQuery,constraintsQuery,indexesQuery,securityQuery,functionQuery,triggerQuery,literal,array,migrationSha} from './hotels-v2-114420-postinstall-contract.mjs';
export function build(catalog){
 const pre=readFileSync('supabase/manual/hotels_v2_114420_after_lineage_reconciliation_preaction_readonly.sql','utf8');
 const pins=pre.slice(pre.indexOf('pins(signature,'),pre.indexOf('specs(ordinal,'));
 const original=[...pre.matchAll(/\((\d+),'([^']+)','([^']+)','([^']+)',\n\s*(ARRAY[^\n]+)\n\s*\$read\1\$([\s\S]*?)\$read\1\$\)/g)];
 assert.equal(original.length,112);
 const specs=original.filter(m=>m[2]!=='collision').map(m=>({section:m[2],name:m[3],expected:m[4],requirements:m[5].trim().replace(/,$/,''),query:m[6]}));
 function add(section,name,query,relations=[],required=[]){specs.push({section,name,expected:'true',requirements:array(relations)+','+array(required),query:'SELECT ('+query+')::text AS actual'});}
 function exact(section,name,query,expected,relations=[]){add(section,name,'('+query+') IS NOT DISTINCT FROM '+literal(JSON.stringify(expected))+'::jsonb',relations);}
 const empty=(name,relation)=>add('install_rows',name,`(SELECT count(*) FROM ${relation})=0`,[relation]);
 for(const table of tables){
  const rel='public.'+table;
  add('bridge_tables',table+'_security',securityQuery(table),[rel]);
  exact('bridge_columns',table,columnsQuery(table),catalog[table+'_columns'],[rel]);
  exact('bridge_constraints',table,constraintsQuery(table),catalog[table+'_constraints'],[rel]);
  exact('bridge_indexes',table,indexesQuery(table),catalog[table+'_indexes'],[rel]);
  empty(table+'_empty',rel);
 }
 exact('booking_columns','eight_pricing_columns_exact',columnsQuery('hotel_bookings'),catalog.hotel_bookings_columns,['public.hotel_bookings']);
 exact('booking_constraints','three_checks_and_no_pricing_fk_drift',constraintsQuery('hotel_bookings'),catalog.hotel_bookings_constraints,['public.hotel_bookings']);
 add('booking_columns','new_columns_no_nonowner_direct_grants',`NOT EXISTS(SELECT 1 FROM pg_attribute col JOIN pg_class c ON c.oid=col.attrelid CROSS JOIN LATERAL aclexplode(col.attacl) a WHERE col.attrelid='public.hotel_bookings'::regclass AND col.attname=ANY(${array(bookingColumns)}) AND a.grantee<>c.relowner)`,['public.hotel_bookings']);
 add('install_rows','no_114420_priced_booking_rows',`NOT EXISTS(SELECT 1 FROM public.hotel_bookings WHERE ${bookingColumns.map(c=>c+' IS NOT NULL').join(' OR ')})`,['public.hotel_bookings']);
 for(const f of functions){
  const expected=catalog.functions.find(c=>c.signature.replace(/^public\./,'')===f.signature.replace(/^public\./,''));
  assert.ok(expected,f.signature);assert.equal(expected.source_sha,f.source_sha);
  const query=functionQuery.replace('p.proname=ANY('+array(functions.map(f=>f.name))+')','p.proname='+literal(f.name));
  exact('bridge_functions',f.signature,query,[expected]);
 }
 exact('bridge_triggers','four_triggers_exact_no_extra',triggerQuery,catalog.triggers);
 // Source and full metadata above prove scope/token/flag ordering without calling mutation RPCs.
 add('partner_contract','manage_prices_hotel_assignment_composite_token_exact',`EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.hotel_v2_partner_get_seven_arches_reviewed_pricing(uuid,uuid)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')=${literal(functions.find(f=>f.name==='hotel_v2_partner_get_seven_arches_reviewed_pricing').source_sha)})`);
 add('public_booking','exact_disabled_gate_before_quote_or_booking_write',`NOT EXISTS(SELECT 1 FROM (VALUES ${functions.filter(f=>['hotel_v2_public_quote_seven_arches','hotel_v2_public_create_seven_arches_booking'].includes(f.name)).map(f=>'('+literal(f.signature)+','+literal(f.source_sha)+')').join(',')}) e(signature,sha) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature) WHERE p.oid IS NULL OR encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') IS DISTINCT FROM e.sha)`);
 add('receipt_chain','public_booking_receipt_chain_exact','public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact() IS TRUE',[],['public.hotel_v2_seven_arches_public_booking_receipt_chain_is_exact()']);
 add('reconciliation','one_114416_receipt','(SELECT count(*) FROM hotels_lineage_private.reconciliation_receipts)=1',['hotels_lineage_private.reconciliation_receipts']);
 add('future','114460_schema_absent',"to_regnamespace('hotel_stripe_connect_private') IS NULL");
 add('future','114470_authorization_functions_absent',"NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('hotel_v2_admin_set_partner_stripe_onboarding_authorization','hotel_v2_admin_get_partner_stripe_onboarding_authorization'))");
 add('future','114480_lifecycle_schema_absent',"to_regnamespace('hotels_lifecycle_private') IS NULL");
 add('future','114480_lifecycle_api_absent',"NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='hotel_v2_admin_get_capability_lifecycle')");
 const count=specs.length+14;
 const tuples=specs.map((s,i)=>`  (${i+1},${literal(s.section)},${literal(s.name)},${literal(s.expected)},\n    ${s.requirements},\n    $check${i+1}$${s.query}$check${i+1}$)`).join(',\n');
 const sql=`BEGIN;\nSET TRANSACTION READ ONLY;\nSET TRANSACTION ISOLATION LEVEL REPEATABLE READ;\nSET LOCAL search_path=pg_catalog,public;\n-- Final 114420 physical postinstall verifier: AFTER install, BEFORE history repair.\n-- Derivation: committed 1299-line migration SHA256 ${migrationSha}.\n-- Expected rows: ${count+1} (${count} required leaves and one summary).\n-- Exact catalog expectations derived from this DDL in disposable PostgreSQL 16.13,\n-- with every new function body independently matched to the committed source.\n-- No credentials, plans, tokens or personal data are returned.\n-- Named function signatures mentioning Preview/Submit are inspected, NEVER invoked.\n-- Fixed SELECT-only query_to_xml inputs; no mutation RPC or explicit write lock.\n-- Human recovery evidence: 09 Sep 2026 05:37:22 UTC, COMPLETED, PHYSICAL, Restore available.\n-- SQL does not verify backups or authorize any later write. No timeout override.\nWITH\n${pins}specs(ordinal,section,leaf_name,expected,required_relations,required_functions,read_query) AS (\n VALUES\n${tuples}\n),\neligibility AS MATERIALIZED (\n SELECT s.*,\n  NOT EXISTS(SELECT 1 FROM unnest(s.required_relations) r(name) WHERE to_regclass(r.name) IS NULL)\n  AND NOT EXISTS(SELECT 1 FROM unnest(s.required_functions) f(signature) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(f.signature)\n   WHERE p.oid IS NULL OR p.provolatile NOT IN('s','i') OR p.proowner<>'postgres'::regrole)\n  AND (cardinality(s.required_functions)=0 OR NOT EXISTS(SELECT 1 FROM pin_results WHERE exact IS NOT TRUE)) AS eligible\n FROM specs s\n),\nmeasurements AS MATERIALIZED (\n SELECT e.*,CASE WHEN eligible THEN (xpath('/table/row/actual/text()',query_to_xml(e.read_query,true,false,'')))[1]::text ELSE NULL END AS actual\n FROM eligibility e\n),\nleaves AS MATERIALIZED (\n SELECT ordinal,section,leaf_name,expected,actual,eligible AND actual IS NOT NULL AND actual=expected AS pass,\n  CASE WHEN NOT eligible THEN 'REQUIRED_OBJECT_OR_SOURCE_CONTRACT_UNAVAILABLE' WHEN actual IS NULL THEN 'NULL_RESULT_FAIL_CLOSED' ELSE 'SAFE_SCALAR_ONLY' END AS safe_context\n FROM measurements\n UNION ALL\n SELECT ${specs.length}+row_number() OVER(ORDER BY signature)::integer,'source_security',signature,'true',exact::text,exact IS TRUE,safe_context FROM pin_results\n),\ntotals AS (\n SELECT bool_and(pass IS TRUE) AS ready,coalesce(jsonb_agg(leaf_name ORDER BY ordinal) FILTER(WHERE pass IS NOT TRUE),'[]'::jsonb) AS blockers,\n count(*) AS required_count,count(*) FILTER(WHERE pass IS TRUE) AS passed_count FROM leaves\n)\nSELECT section,ordinal,leaf_name,expected,actual,pass,safe_context,\n NULL::boolean AS \"POSTINSTALL_READY\",NULL::jsonb AS blocker_codes,NULL::bigint AS required_leaf_count,NULL::bigint AS passed_leaf_count\nFROM leaves\nUNION ALL\nSELECT 'final_gate',${count+1},'POSTINSTALL_READY','true',ready::text,ready,\n 'PHYSICAL_POSTINSTALL_BEFORE_REPAIR; NOT_WRITE_AUTHORIZATION; SQL_BACKUP_PROOF=NO',ready,blockers,required_count,passed_count FROM totals\nORDER BY ordinal;\nROLLBACK;\n`;
 return {sql,leaves:count,rows:count+1};
}
if(process.argv[2]){const result=build(JSON.parse(readFileSync(process.argv[2],'utf8')));process.stdout.write(result.sql);}
