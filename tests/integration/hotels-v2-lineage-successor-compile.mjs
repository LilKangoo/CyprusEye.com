// Compile exact successor evidence in a disposable database transaction.
// Capturing AFTER definitions is not a successful installation proof. All
// prefix DDL is rolled back; no composite is bypassed to claim a PASS.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
const db=process.env.HOTELS_RECONCILIATION_DB;
const bin=process.env.HOTELS_RECONCILIATION_PSQL;
assert.match(db||'',/^hotels_114416_successor_[a-z0-9_]+$/);assert.ok(bin);
function sql(input){const r=spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',db],{input,encoding:'utf8',maxBuffer:32e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),`${db}|127.0.0.1|55479`);
const source=readFileSync(new URL('supabase/migrations/20260811445000_hotels_v2_external_calendar_provider_types.sql',root),'utf8');
const list=source.match(/v_receipt\.changed_function_signatures is not distinct from array\[([\s\S]*?)\]::text\[\]/)[1];
const signatures=[...list.matchAll(/'([^']+)'/g)].map(m=>m[1]);assert.equal(signatures.length,24);
const query=`SELECT jsonb_object_agg(signature,jsonb_build_object(
 'source',encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex'),
 'definition',public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(p.oid))),
 'metadata',hotels_lineage_private.successor_metadata(p.oid)))
 FROM unnest(ARRAY[${signatures.map(s=>`'${s}'`).join(',')}]::text[]) x(signature)
 JOIN pg_proc p ON p.oid=to_regprocedure(signature);`;
const before=JSON.parse(sql('BEGIN READ ONLY;'+query+'ROLLBACK;'));
assert.equal(Object.keys(before).length,24);
assert.equal(sql("SELECT to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') IS NULL"),'t');
const marker='-- Finalize the exact evolved function/catalog layer';
assert.equal(source.split(marker).length,2);
const output=sql(source.slice(0,source.indexOf(marker))+'\n'+query+'\nROLLBACK;');
const after=JSON.parse(output.split('\n').filter(s=>s.startsWith('{')).at(-1));
assert.equal(Object.keys(after).length,24);
const manifest={};
for(const signature of signatures){
 if(signature==='public.hotel_v2_partner_apply_external_calendar_plan(jsonb,uuid,uuid,text)'){
  assert.equal(before[signature].metadata.language,'sql');assert.equal(after[signature].metadata.language,'plpgsql');
  assert.deepEqual({...before[signature].metadata,language:'plpgsql'},after[signature].metadata,
   `unexpected provider-owned metadata change: ${signature}`);
 }else assert.deepEqual(before[signature].metadata,after[signature].metadata,`metadata changed: ${signature}`);
 assert.notEqual(before[signature].source,after[signature].source,`declared change absent: ${signature}`);
 manifest[signature]={before_source:before[signature].source,before_definition:before[signature].definition,
  after_source:after[signature].source,after_definition:after[signature].definition,
  before_metadata:before[signature].metadata,after_metadata:after[signature].metadata};
}
assert.equal(sql("SELECT to_regclass('hotels_v2_private.hotel_external_calendar_provider_evolution_receipts') IS NULL"),'t');
console.log(JSON.stringify({stage:114450,manifest,rolled_back:true,installation_proven:false},null,2));
