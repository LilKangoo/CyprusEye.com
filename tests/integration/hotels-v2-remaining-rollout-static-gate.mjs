// Offline artifact/parser checks; no PostgreSQL connection and no file writes.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {build,loadCatalogs} from './hotels-v2-remaining-rollout-build.mjs';
import {stages,migration,hash} from './hotels-v2-remaining-rollout-contract.mjs';
const catalogs=loadCatalogs(),gates=[];
const prior470=spawnSync('git',['show','83b00502f69c6343ba8750ad2db635b4eed874ad:supabase/migrations/20260811447000_hotels_v2_partner_stripe_onboarding_authorization.sql'],{encoding:'utf8'});
assert.equal(prior470.status,0,prior470.stderr);assert.equal(hash(prior470.stdout),'7eda4c43fcd4374e30221a0c7d3606090a3414ba4f9d2cf27363474bba1875c0');
const tableBoundary='create table hotel_stripe_connect_private.onboarding_authorizations';
assert.equal(migration(114470).sql.slice(migration(114470).sql.indexOf(tableBoundary)),prior470.stdout.slice(prior470.stdout.indexOf(tableBoundary)),'114470 business/runtime code must remain byte-identical');
assert.equal(migration(114470).sql,readFileSync('/private/tmp/hotels_v2_prod_114470.sql','utf8'));
for(const stage of stages){migration(stage);for(const phase of ['preaction','postinstall']){
 const g=build(stage,phase,catalogs),name=`hotels_v2_${stage}_${phase}_readonly.sql`;
 assert.equal(g.sql,readFileSync('supabase/manual/'+name,'utf8'));
 assert.equal(g.sql,readFileSync('/private/tmp/'+name,'utf8'));
 assert.doesNotMatch(g.sql,/^\\|```|&(?:lt|gt|amp);/m);
 assert.match(g.sql,/complete_protected_function_universe_exact/);
 assert.match(g.sql,/booking_owner_trigger_exact/);
 gates.push({stage,phase,sha256:hash(g.sql),lines:g.sql.split('\n').length-1,rows:g.rows,sql:g.sql,queries:g.specs.map(s=>s.query)});
}}
for(const name of ['is_current_user_admin()','hotel_bookings_assign_authenticated_owner()','hotel_v2_admin_apply_pricing_control_plan(jsonb,uuid,text)']){
 const altered=structuredClone(catalogs);altered[114425].functions.find(f=>f.signature===name).source_sha='0'.repeat(64);
 assert.throws(()=>build(114450,'preaction',altered),/AssertionError/);
}
// pglast is a local parser dependency, supplied via PYTHONPATH if not installed.
const python=String.raw`import sys,json
from pglast import parse_sql, ast
from pglast.visitors import Visitor
class Safe(Visitor):
 def visit_FuncCall(self,ancestors,node):
  name='.'.join(v.sval for v in node.funcname)
  assert not any(x in name.split('.')[-1].split('_') for x in ['apply','preview','submit','enqueue','cleanup']), name
 def visit_SelectStmt(self,a,n):
  assert not n.intoClause and not n.lockingClause
  assert n.withClause is None or all(isinstance(c.ctequery,ast.SelectStmt) for c in n.withClause.ctes)
for g in json.load(sys.stdin):
 outer=parse_sql(g['sql']); assert len(outer)==6
 assert isinstance(outer[0].stmt,ast.TransactionStmt) and isinstance(outer[-1].stmt,ast.TransactionStmt)
 assert g['sql'].startswith('BEGIN;\nSET TRANSACTION READ ONLY;\nSET TRANSACTION ISOLATION LEVEL REPEATABLE READ;') and g['sql'].endswith('ROLLBACK;\n')
 for i in [1,2,3]: assert isinstance(outer[i].stmt,ast.VariableSetStmt)
 assert isinstance(outer[4].stmt,ast.SelectStmt); Safe()(outer[4].stmt)
 for q in g['queries']:
  parsed=parse_sql(q); assert len(parsed)==1 and isinstance(parsed[0].stmt,ast.SelectStmt); Safe()(parsed[0].stmt)
`;
const parsed=spawnSync(process.env.HOTELS_PARSER_PYTHON||'python3',['-c',python],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},input:JSON.stringify(gates),encoding:'utf8',maxBuffer:4e6});
assert.equal(parsed.status,0,parsed.stderr);
console.log(JSON.stringify({parser_readonly:'PASS',gates:8,embedded_selects:gates.reduce((n,g)=>n+g.queries.length,0),source_provenance_negative_tests:3,execution_copies_identical:8,migration_hashes_exact:4,migration_114470_business_body_unchanged:true,migration_114470_manual_copy_exact:true,artifacts:gates.map(({sql,queries,...g})=>g),production_access:false}));
