import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {stageMatrix} from './hotels-v2-lineage-stage-matrix.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const db=process.env.HOTELS_RECONCILIATION_DB;
const bin=process.env.HOTELS_RECONCILIATION_PSQL;
assert.match(db||'',/^hotels_114416_successor_[a-z0-9_]+$/);assert.ok(bin);
function expand(path){assert.ok(path.startsWith(root));return readFileSync(path,'utf8').replace(/^\\ir ([^\n]+)$/gm,(_,p)=>expand(resolve(dirname(path),p.trim())));}
function sql(input){const r=spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',db],{input,encoding:'utf8',maxBuffer:16e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),`${db}|127.0.0.1|55479`);
const path=resolve(root,'tests/integration/hotels-v2-capability-lifecycle-forward-postgres-gate.sql');
const original=readFileSync(path,'utf8');
if(process.argv[2]==='matrix416')stageMatrix(sql,114416);
if(process.argv[2]==='prelude'){
 assert.equal(sql("SELECT to_regprocedure('public.hotel_v2_public_quote_seven_arches(jsonb)') IS NULL"),'t');
 const prefix=original.slice(0,original.indexOf('\\ir ../../supabase/migrations/20260811442000'));
 console.log(sql(prefix.replace("'^hotels_functional_global_'","'^hotels_114416_successor_'")));
}
if(['before450','afterPrelude'].includes(process.argv[2])){
 assert.equal(sql("SELECT to_regprocedure('public.hotel_v2_public_quote_seven_arches(jsonb)') IS NULL"),'t');
 const prefix=original.slice(process.argv[2]==='afterPrelude'?original.indexOf('\\ir ../../supabase/migrations/20260811442000'):0,original.indexOf('\\ir ../../supabase/migrations/20260811445000'));
 if(process.argv[2]==='afterPrelude'){
  for(const entry of prefix.matchAll(/^\\ir ([^\n]+)$/gm)){
   console.log(sql(expand(resolve(dirname(path),entry[1].trim()))));
   const stage=entry[1].match(/migrations\/202608(114\d{3})00/);
   if(stage)stageMatrix(sql,Number(stage[1]));
  }
 }else console.log(sql(prefix.replace("'^hotels_functional_global_'","'^hotels_114416_successor_'")
  .replace(/^\\ir ([^\n]+)$/gm,(_,p)=>expand(resolve(dirname(path),p.trim())))));
 console.log(sql(`SELECT public.hotel_v2_seven_arches_pricing_scoped_lineage() IS NOT NULL,
 public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact(),
 public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),
 public.hotel_v2_seven_arches_pricing_activation_current_is_safe()`));
}
if(process.argv[2]==='450'){
 assert.equal(sql("SELECT to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') IS NULL"),'t');
 const started=performance.now();
 console.log(sql(readFileSync(resolve(root,'supabase/migrations/20260811445000_hotels_v2_external_calendar_provider_types.sql'),'utf8')));
 console.log(`LOCAL_114450_INSTALL_MS=${(performance.now()-started).toFixed(3)}`);
 if(process.env.HOTELS_SUCCESSOR_EXACT_MATRIX==='1')stageMatrix(sql,114450);
 console.log(sql(`SELECT hotels_lineage_private.current_anchor_is_exact(),
 public.hotel_v2_seven_arches_pricing_scoped_lineage() IS NOT NULL,
 public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact(),
 public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),
 public.hotel_v2_seven_arches_pricing_activation_current_is_safe(),
 public.hotel_v2_external_calendar_provider_evolution_is_safe()`));
}
if(process.argv[2]==='before480'){
 assert.equal(sql("SELECT to_regnamespace('hotels_lifecycle_private') IS NULL"),'t');
 const chunk=original.slice(original.indexOf('\\ir ../../supabase/manual/hotels_v2_external_calendar_provider_types_verify.sql'),
  original.indexOf('\\ir ../../supabase/migrations/20260811448000'));
 for(const entry of chunk.matchAll(/^\\ir ([^\n]+)$/gm)){
  const started=performance.now();console.log(sql(expand(resolve(dirname(path),entry[1].trim()))));
  console.log(`LOCAL_STEP_MS=${(performance.now()-started).toFixed(3)}; FILE=${entry[1].trim()}`);
  const stage=entry[1].match(/migrations\/202608(114\d{3})00/);
  if(stage&&process.env.HOTELS_SUCCESSOR_EXACT_MATRIX==='1')stageMatrix(sql,Number(stage[1]));
 }
}
if(process.argv[2]==='480'){
 assert.equal(sql("SELECT to_regnamespace('hotels_lifecycle_private') IS NULL"),'t');
 const started=performance.now();
 const chunk=original.slice(original.indexOf('\\ir ../../supabase/migrations/20260811448000'));
 console.log(sql(chunk.replace(/^\\ir ([^\n]+)$/gm,(_,p)=>expand(resolve(dirname(path),p.trim())))));
 console.log(`LOCAL_114480_INSTALL_AND_VERIFY_MS=${(performance.now()-started).toFixed(3)}`);
 if(process.env.HOTELS_SUCCESSOR_EXACT_MATRIX==='1')stageMatrix(sql,114480);
 console.log(sql(`SELECT hotels_lineage_private.current_anchor_is_exact(),
 public.hotel_v2_seven_arches_pricing_scoped_lineage() IS NOT NULL,
 public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact(),
 public.hotel_v2_seven_arches_independent_pricing_topology_is_exact(),
 public.hotel_v2_seven_arches_pricing_activation_current_is_safe(),
 public.hotel_v2_external_calendar_provider_evolution_is_safe()`));
}
