import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const bin=process.env.HOTELS_RECONCILIATION_PSQL;
const db=process.env.HOTELS_RECONCILIATION_DB;
assert.match(db||'',/^hotels_(114416_[a-z0-9_]+|functional_global_verified_20260908)$/);
assert.ok(bin);
const r=spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',db],{
 input:`BEGIN READ ONLY; SELECT jsonb_agg(jsonb_build_object('name',n.nspname||'.'||p.proname,
 'signature',p.oid::regprocedure::text,'source',p.prosrc)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind='f' AND n.nspname IN ('public','hotels_v2_private','hotels_lifecycle_private','hotels_lineage_private'); ROLLBACK;`,
 encoding:'utf8',maxBuffer:32e6});
assert.equal(r.status,0,r.stderr);
const rows=JSON.parse(r.stdout.trim());
const graph=new Map();
// PostgreSQL truncates unquoted ASCII identifiers at NAMEDATALEN-1, including
// the historical Property-attribution function name. Resolve that real edge.
const canonicalName=name=>name.split('.').map(part=>part.slice(0,63)).join('.');
for(const row of rows){
 const masked=row.source.replace(/\$([a-z_][a-z0-9_]*|)\$[\s\S]*?\$\1\$|'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\//gi,s=>' '.repeat(s.length));
 const callPattern=/\b((?:public|hotels_v2_private|hotels_lifecycle_private|hotels_lineage_private)\.[a-z0-9_]+)\s*\(/g;
 const directCalls=[...new Set([...masked.matchAll(callPattern)].map(m=>canonicalName(m[1])))];
 const dynamicCalls=[];const dynamicSql=[];const unresolvedDynamic=[];
 for(const match of masked.matchAll(/\bexecute\b/gi)){
   const end=masked.indexOf(';',match.index);
   const fragment=row.source.slice(match.index+match[0].length,end);
   // Only literal SQL (including literal concatenation) is resolved here.
   // Variable-built SQL is reported explicitly, never counted as safe.
   const expression=fragment.split(/\binto\b/i)[0].trim();
   const literals=[...expression.matchAll(/\$([a-z_][a-z0-9_]*|)\$([\s\S]*?)\$\1\$|'((?:''|[^'])*)'/gi)];
   const remainder=expression.replace(/\$([a-z_][a-z0-9_]*|)\$[\s\S]*?\$\1\$|'(?:''|[^'])*'/gi,'').replace(/\|\||\s/g,'');
   if(!literals.length||remainder){unresolvedDynamic.push(expression);continue;}
   const query=literals.map(m=>m[2]??m[3].replaceAll("''","'")).join('');
   dynamicSql.push(query);
   dynamicCalls.push(...[...query.matchAll(callPattern)].map(m=>canonicalName(m[1])));
 }
 const calls=[...new Set([...directCalls,...dynamicCalls])];
 graph.set(row.name,{...row,calls,directCalls,dynamicCalls:[...new Set(dynamicCalls)],dynamicSql,unresolvedDynamic});
}
const scoped='public.hotel_v2_seven_arches_pricing_scoped_lineage';
function reaches(name,target,seen=new Set()){
 if(name===target)return true;if(seen.has(name))return false;seen.add(name);
 return (graph.get(name)?.calls||[]).some(c=>reaches(c,target,seen));
}
const chosen=[...graph.values()].filter(r=>/hotels_lineage_private\.|scoped_lineage|provider_lineage_bridge|independent_pricing_activation_lineage|independent_pricing_topology_is_exact|reviewed_pricing_receipt_chain_is_exact|hotels_lifecycle_private\.(chain_state|predecessor_source|predecessor_definition|catalog_snapshot)/.test(r.name));
const closure=new Set();
function include(name){if(closure.has(name))return;closure.add(name);for(const child of graph.get(name)?.calls||[])include(child);}
for(const row of chosen)include(row.name);
const cycles=[];
function cycleWalk(name,path){if(path.includes(name)){cycles.push([...path.slice(path.indexOf(name)),name]);return;}
 for(const child of graph.get(name)?.calls||[])cycleWalk(child,[...path,name]);}
cycleWalk(scoped,[]);
const uniqueCycles=[...new Map(cycles.map(c=>[c.join(' -> '),c])).values()];
assert.equal(uniqueCycles.length,0,'installed fixture contains scoped-lineage recursion');
const anchor='hotels_lineage_private.current_anchor_is_exact';
if(graph.has(anchor))assert.equal(reaches(anchor,scoped),false,'anchor can reenter scoped lineage');
const unresolved=[...closure].flatMap(name=>(graph.get(name)?.unresolvedDynamic||[]).map(sql=>({function:name,sql})));
// Deliberately insert the rejected fallback in memory only. The graph must
// detect its actual provider -> scoped edge; never install a recursive body.
let recursionTrap=false;
if(graph.has(anchor)){
 const calls=graph.get(anchor).calls;
 calls.push('public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact');
 recursionTrap=reaches(anchor,scoped);
 calls.pop();assert.equal(recursionTrap,true,'naive cycle detector did not detect reentry');
}
console.log(JSON.stringify({database:db,scoped_cycles:uniqueCycles,naive_recursion_trap_detected:recursionTrap,unresolved_dynamic_sql:unresolved,functions:[...closure].filter(name=>graph.has(name)).map(name=>graph.get(name)).map(({name,signature,source,calls,directCalls,dynamicCalls,dynamicSql,unresolvedDynamic})=>({
 function:signature,calls,called_by:[...graph.values()].filter(r=>r.calls.includes(name)).map(r=>r.name),
 reads_receipt:/\b(receipts|reconciliation_receipts|foundation|bindings)\b|_receipts/.test(source),
 reads_current_catalog:/pg_proc|pg_class|pg_namespace|pg_get_functiondef|pg_policy|pg_trigger|pg_attribute/.test(source),
 reads_scoped_lineage:calls.includes(scoped),can_reenter_scoped_lineage:calls.some(c=>reaches(c,scoped)),
 direct_calls:directCalls,dynamic_calls:dynamicCalls,dynamic_sql:dynamicSql,unresolved_dynamic_sql:unresolvedDynamic
 }))},null,2));
