// Definition compiler only. Local transaction rolls back every CREATE OR
// REPLACE. The real 114480 migration must separately pass all runtime checks.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),db=process.env.HOTELS_RECONCILIATION_DB,
 bin=process.env.HOTELS_RECONCILIATION_PSQL;
assert.match(db||'',/^hotels_114416_successor_[a-z0-9_]+$/);assert.ok(bin);
function sql(input){const r=spawnSync(bin,['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55479','-U','postgres','-d',db],{input,encoding:'utf8',maxBuffer:32e6});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(sql("SELECT current_database()||'|'||host(inet_server_addr())||'|'||inet_server_port()"),`${db}|127.0.0.1|55479`);
const source=readFileSync(new URL('supabase/migrations/20260811448000_hotels_v2_audited_capability_lifecycle.sql',root),'utf8');
const manifest=JSON.parse(source.match(/\$manifest\$([\s\S]*?)\$manifest\$/)[1]);assert.equal(manifest.length,31);
const query=`SELECT jsonb_object_agg(signature,jsonb_build_object('body',p.prosrc,
 'definition_text',pg_get_functiondef(p.oid),
 'source',encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex'),
 'definition',public.hotel_v2_h3_2b_hash(to_jsonb(pg_get_functiondef(p.oid))),
 'metadata',hotels_lineage_private.successor_metadata(p.oid)))
 FROM unnest(ARRAY[${manifest.map(e=>`'${e.signature}'`).join(',')}]::text[]) x(signature)
 JOIN pg_proc p ON p.oid=to_regprocedure(signature);`;
const before=JSON.parse(sql('BEGIN READ ONLY;'+query+'ROLLBACK;'));assert.equal(Object.keys(before).length,31);
const exactChangedBefore={
 'public.hotel_v2_seven_arches_pricing_scoped_lineage()':'196c9b7ffa1901cbbafcbd05dadc722546ae1ed07e5a0170e97b4e2b3e5cf2e8',
 'public.hotel_v2_admin_d_current_foundation_snapshot()':'d5fc70d1a21b4a33e40479d3f1f449103cfc9904ad4108797eff9da6fe7e3c68',
 'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()':'9274511497439aecd69a3ad839f44852afbc3023650ff1d27e0ce3ebcb149690',
 'public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact()':'d5715bd29b456053bb32b0cf26793553617e8082443762091b7643943d5282db'
};
const definitions=[],changes=[];
for(const e of manifest){
 const current=before[e.signature];let body=current.body;const patches=[];
 assert.equal(current.source,exactChangedBefore[e.signature]??e.before,`unapproved BEFORE: ${e.signature}`);
 for(const p of structuredClone(e.patches)){
  const count=body.split(p.needle).length-1;
  const removedFallbackNeedles=[
   '))\n       and not public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())\n     or v_founda',
   ' public.hotel_v2_seven_arches_reviewed_pricing_catalog_fingerprint()\n',
   ' public.hotel_v2_external_calendar_provider_lineage_bridge_is_exact())'
  ];
  if(e.signature==='public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()'
    && removedFallbackNeedles.includes(p.needle)){
   assert.equal(count,0,'removed historical fallback unexpectedly remains');
   continue; // 114416 replaced these two guards with exact low-level evidence.
  }
  if(count!==p.count){
   assert.equal(e.signature,'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()');
   assert.equal(p.needle,'pg_get_functiondef(');assert.equal(count,p.count-1);
   // 114416 replaced exactly one topology-definition read with its protected
   // predecessor hash accessor. No other lifecycle patch cardinality changes.
   p.count=count;
  }
  body=body.split(p.needle).join(p.replacement);
  patches.push(p);
 }
 const after=createHash('sha256').update(body).digest('hex');
 if(!exactChangedBefore[e.signature])assert.equal(after,e.after,`unexpected AFTER: ${e.signature}`);
 assert.equal(current.definition_text.split(current.body).length-1,1);
 definitions.push(current.definition_text.replace(current.body,()=>body));
 if(current.source!==e.before||after!==e.after)changes.push({signature:e.signature,before:current.source,after,patches});
}
const after=JSON.parse(sql('BEGIN; SET LOCAL check_function_bodies=off;\n'+definitions.join(';\n')+';\n'+query+'ROLLBACK;'));
const pins={};
for(const e of manifest){const b=before[e.signature],a=after[e.signature];assert.deepEqual(b.metadata,a.metadata);
 pins[e.signature]={before_source:b.source,before_definition:b.definition,after_source:a.source,
  after_definition:a.definition,before_metadata:b.metadata,after_metadata:a.metadata};}
const restored=JSON.parse(sql('BEGIN READ ONLY;'+query+'ROLLBACK;'));assert.deepEqual(restored,before);
console.log(JSON.stringify({stage:114480,changes,pins,rolled_back:true,installation_proven:false},null,2));
