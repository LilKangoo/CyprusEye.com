// Offline package builder/validator. Never connects to a database or executes SQL.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export const root='/private/tmp/hotels-lineage-successor-final';
const sha=s=>createHash('sha256').update(s).digest('hex');
const hotel='9b6d99a0-923a-4fbc-be54-c066e856e6ca';
const partner='0a321bfe-da6b-43f6-8e0b-7c68546a8b18';
const assignment='a082c085-a6ea-46fd-8548-c8d9c6ee2c34';
export const capabilities=['edit_property_content','edit_property_photos','edit_room_content','edit_room_photos','create_rooms','edit_room_structure','manage_prices','manage_availability','process_bookings','request_booking_changes','view_payment_status','initiate_stripe_onboarding'];
const lit=x=>"'"+x.replaceAll("'","''")+"'";
const checks=[
 ['target_assignment_owner_exact',`EXISTS(SELECT 1 FROM public.partner_resources a JOIN public.hotels h ON h.id=a.resource_id JOIN public.partners p ON p.id=a.partner_id WHERE a.id='${assignment}' AND a.partner_id='${partner}' AND a.resource_type='hotels' AND h.id='${hotel}' AND h.owner_partner_id=p.id AND p.status='active' AND p.can_manage_hotels IS TRUE)`],
 ['owner_membership_present',`EXISTS(SELECT 1 FROM public.partner_users WHERE partner_id='${partner}' AND role='owner')`],
 ['target_permission_v2_all_twelve_exact',`EXISTS(SELECT 1 FROM public.hotel_partner_hotel_permissions WHERE assignment_id='${assignment}' AND partner_id='${partner}' AND hotel_id='${hotel}' AND version=2 AND ${capabilities.map(k=>k+' IS TRUE').join(' AND ')})`],
 ['no_unexpected_later_hotels_history',`NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version::text ~ '^20260811[0-9]{6}$' AND version::text > '20260811448000')`],
 ['target_partner_stripe_authorization_disabled',`hotel_stripe_connect_private.authorization_state('${partner}') @> '{"version":0,"enabled":false}'::jsonb`],
 ['no_target_connected_account',`NOT EXISTS(SELECT 1 FROM hotel_stripe_connect_private.accounts WHERE partner_id='${partner}')`],
 ['no_target_oauth_state',`NOT EXISTS(SELECT 1 FROM hotel_stripe_connect_private.oauth_states WHERE partner_id='${partner}')`],
];
const projection=(table,where='true')=>`(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::jsonb)::text,'UTF8')),'hex') FROM ${table} r WHERE ${where})`;
// Only opaque hashes leave SQL; no row payload, account ID, identity or tokens.
// Compare all baseline fingerprints between the two results. They are NOT auto-sealed.
const baselineTables=['public.hotel_partner_hotel_permissions','public.partner_resources','public.hotel_room_rates','public.hotel_rate_plans','public.hotel_pricing_schedules','public.hotel_pricing_schedule_occupancy_tiers','public.hotel_seven_arches_independent_pricing_authority','public.hotel_commission_policies'];
const reports=[
 ['target_permission_safe_inventory',`(SELECT jsonb_build_object('hotel_id',hotel_id,'partner_id',partner_id,'assignment_id',assignment_id,'version',version,'capabilities',jsonb_build_object(${capabilities.map(k=>lit(k)+','+k).join(',')}))::text FROM public.hotel_partner_hotel_permissions WHERE assignment_id='${assignment}' AND hotel_id='${hotel}' AND partner_id='${partner}')`],
 ['stripe_authorization_safe_inventory',`(SELECT jsonb_build_object('enabled',s->'enabled','version',s->'version')::text FROM (SELECT hotel_stripe_connect_private.authorization_state('${partner}') s) x)`],
 ['stripe_account_safe_inventory',`(SELECT jsonb_build_object('account_rows',count(*),'status',CASE WHEN count(*)=0 THEN 'NOT_CONNECTED' ELSE min(status) END)::text FROM hotel_stripe_connect_private.accounts WHERE partner_id='${partner}')`],
 ['stripe_readiness_safe_inventory',`(SELECT jsonb_build_object('attestation_count',count(*),'fresh_verified',coalesce((SELECT ready AND contract_version='hotels_standard_connect_server_v1' AND checked_at>statement_timestamp()-interval '15 minutes' FROM hotels_lifecycle_private.stripe_readiness ORDER BY checked_at DESC,request_id DESC LIMIT 1),false))::text FROM hotels_lifecycle_private.stripe_readiness)`],
 ['edge_worker_runtime_verification',lit('NOT_PROVEN_BY_SQL: deployed worker must match committed booking_com/airbnb/ical parser and RPC contract; separate human read-only evidence required')],
 ['baseline_comparison_requirement',lit('Compare every baseline_sha256 row with preactivation output. Equality required; no activation write is planned. SQL cannot prove external money movement or deployed Edge identity.')],
 ...baselineTables.map(t=>['baseline_sha256:'+t,projection(t)]),
];
export function build(phase){
 assert.ok(['preactivation','postactivation'].includes(phase));
 let sql=fs.readFileSync(root+'/supabase/manual/hotels_v2_114480_postinstall_readonly.sql','utf8');
 assert.equal(sha(sql),'17985a514c7f459f5681d24ce3c910d45b5251c5e0bb064bc636cb93cd56085e');
 assert.equal((sql.match(/\(72,'history','recorded_114480','0'/g)||[]).length,1);
 sql=sql.replace("(72,'history','recorded_114480','0'","(72,'history','recorded_114480','1'");
 sql=sql.replace('-- Current stage remains UNRECORDED, including postinstall-before-repair.','-- All stages through 114480 must now be RECORDED. Not an installation gate.');
 sql=sql.replace('-- Backup is an EXTERNAL human gate: 09 Sep 2026 05:37:22 UTC; COMPLETED; PHYSICAL.','-- No backup claim. No activation write is planned. Human runtime and paired-baseline checks remain external.');
 sql=sql.replace('-- Final successor 114480 postinstall; migration-derived predecessor provenance.',`-- Admin/Partner ${phase}: zero-write retained-flags completion, checkpoint 4f73589177a70d23cbafd52a0549495f83401737.`);
 const additions=checks.map(([name,q],i)=>` UNION ALL SELECT ${523+i},'completion_required',${lit(name)},'true',v::text,v IS TRUE FROM (SELECT CASE WHEN (SELECT exact FROM catalog_guard) THEN (${q}) ELSE false END v) x`).join('\n');
 sql=sql.replace('), totals AS (',()=>additions+'\n), totals AS (');
 const reportCte=reports.map(([name,q],i)=>`SELECT ${8000+i} ordinal,${lit(name)} name,CASE WHEN (SELECT exact FROM catalog_guard) THEN (${q}) ELSE NULL::text END actual`).join('\n UNION ALL ');
 sql=sql.replace("SELECT section,ordinal,leaf_name,expected,actual,pass,NULL::boolean",`, completion_reports AS MATERIALIZED (\n ${reportCte}\n)\nSELECT section,ordinal,leaf_name,expected,actual,pass,NULL::boolean`);
 const label=phase==='preactivation'?'PREACTIVATION_DB_SAFE':'POSTACTIVATION_DB_SAFE';
 sql=sql.replaceAll('POSTINSTALL_READY',label);
 sql=sql.replace("UNION ALL SELECT 'final_gate',523",`UNION ALL SELECT 'completion_report',ordinal,name,'REPORT_ONLY',actual,NULL::boolean,NULL::boolean,NULL::jsonb,NULL::bigint,NULL::bigint FROM completion_reports\nUNION ALL SELECT 'final_gate',9999`);
 const rows=523+checks.length+reports.length;
 sql=sql.replace('-- Expected rows: 523 (522 required leaves and one summary).',`-- Expected rows: ${rows} (${522+checks.length} required leaves, ${reports.length} report-only rows, one summary).\n-- DB_SAFE is not a production completion claim: verify paired baseline hashes and human E2E separately.\n-- Postactivation name is retained for the requested handoff; selected activation write count is ZERO.`);
 return {sql,rows,leaves:522+checks.length,reports:reports.length};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const artifacts=[];
 for(const phase of ['preactivation','postactivation']){
  const {sql,rows}=build(phase),name=`hotels_v2_admin_partner_completion_${phase}_readonly.sql`;
  assert.equal(sql,fs.readFileSync(root+'/supabase/manual/'+name,'utf8'));
  assert.equal(sql,fs.readFileSync('/private/tmp/'+name,'utf8'));
  assert.ok(sql.includes("'recorded_114480','1'"));
  assert.doesNotMatch(sql,/^\\|```|&(?:lt|gt|amp);/m);
  artifacts.push({phase,sql,rows,sha:sha(sql),lines:sql.split('\n').length-1});
 }
 const parser=String.raw`import sys,json,re
from pglast import parse_sql,ast
from pglast.visitors import Visitor
class Safe(Visitor):
 def visit_SelectStmt(self,a,n):
  assert not n.intoClause and not n.lockingClause
  assert n.withClause is None or all(isinstance(c.ctequery,ast.SelectStmt) for c in n.withClause.ctes)
 def visit_FuncCall(self,a,n):
  name='.'.join(x.sval for x in n.funcname)
  assert not any(x in name.split('.')[-1].split('_') for x in ['apply','preview','submit','enqueue','cleanup','set','attest']),name
for item in json.load(sys.stdin):
 s=item['sql']; statements=parse_sql(s);assert len(statements)==6
 assert s.startswith('BEGIN;\nSET TRANSACTION READ ONLY;\nSET TRANSACTION ISOLATION LEVEL REPEATABLE READ;') and s.endswith('ROLLBACK;\n')
 assert isinstance(statements[0].stmt,ast.TransactionStmt) and isinstance(statements[-1].stmt,ast.TransactionStmt)
 assert all(isinstance(statements[i].stmt,ast.VariableSetStmt) for i in [1,2,3])
 assert isinstance(statements[4].stmt,ast.SelectStmt);Safe()(statements[4].stmt)
 for q in re.findall(r'\$check\d+\$(.*?)\$check\d+\$',s,re.S):
  tree=parse_sql(q);assert len(tree)==1 and isinstance(tree[0].stmt,ast.SelectStmt);Safe()(tree[0].stmt)
for q in ['SELECT 1 INTO bad','SELECT * FROM public.hotels FOR UPDATE','WITH x AS (DELETE FROM public.hotels RETURNING id) SELECT * FROM x','SELECT public.hotel_v2_admin_apply_pricing_control_plan(null,null,null)']:
 try:
  tree=parse_sql(q);assert isinstance(tree[0].stmt,ast.SelectStmt);Safe()(tree[0].stmt)
 except AssertionError: pass
 else: raise AssertionError('Unsafe statement accepted')
print('READ_ONLY_AST=PASS; ONE_RESULT_SET=PASS; SAFETY_NEGATIVES=4/4; SQL_EXECUTED=NO')`;
 const parsed=spawnSync('python3',['-c',parser],{input:JSON.stringify(artifacts),encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 assert.equal(parsed.status,0,parsed.stderr);
 console.log(parsed.stdout.trim());console.log(JSON.stringify(artifacts.map(({sql,...a})=>a),null,2));
}
