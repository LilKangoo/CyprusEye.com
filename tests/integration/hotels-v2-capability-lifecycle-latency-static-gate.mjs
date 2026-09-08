// No database access. Prove the six optimizations only share identical read-only
// inputs within an invocation; restore them and compare the accepted prior body.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
const source=readFileSync(new URL('../../supabase/migrations/20260811448000_hotels_v2_audited_capability_lifecycle.sql',import.meta.url),'utf8');
const manifest=JSON.parse(source.match(/\$manifest\$(.*?)\$manifest\$/s)[1]);
const before={
 'public.hotel_v2_seven_arches_task2_stage2_canonical_snapshot()':'845fb884c65e4f7032a842b65f72e51781dc735752f0a7187089b0d738598fe7',
 'public.hotel_v2_seven_arches_task2_stage2_compatibility_is_exact()':'13189dd3da497e5b7b2ecbbf19adbf17768dbeaa0652f1bcfc6de61d2bee4ae7',
 'public.hotel_v2_seven_arches_independent_pricing_activation_lineage()':'ab261970543cec2947000ead306dd76a1fde664b3b9965bedee838dcd01635f1',
 'public.hotel_v2_seven_arches_reviewed_pricing_receipt_chain_is_exact()':'edb12f7c33b4baf5d7c220e5a82066ab011987feddfc5a84c038df7421fa1d0e',
 'public.hotel_v2_admin_d_current_foundation_snapshot()':'926d2ebcd38d3de0fc704f84a68d64115464021a17207d2b086d581d62e812d8',
 'public.hotel_v2_external_calendar_provider_evolution_is_safe()':'02a87de27c33ea05b373692e9a48119972ffe66568ce80e0a62230f4fa7d6916',
};
export function undoSharing(body){
 const bindings=[];
 body=body.replace(/\bdeclare\n  -- Read-only STABLE inputs: one evaluation per invocation\/snapshot; never cached across calls\.\n(  v_lifecycle_once_\d+ constant (?:boolean|jsonb|text):=[a-z0-9_.]+\(\);(?:\n  v_lifecycle_once_\d+ constant (?:boolean|jsonb|text):=[a-z0-9_.]+\(\);)*)/,(_,declarations)=>{
  for(const m of declarations.matchAll(/(v_lifecycle_once_\d+) constant (?:boolean|jsonb|text):=([a-z0-9_.]+\(\));/g))bindings.push([m[1],m[2]]);
  return 'declare';
 });
 const cte=body.match(/^\nWITH (v_lifecycle_once_[\s\S]*?)\n(?=\nselect)/);
 if(cte){for(const m of cte[1].matchAll(/(v_lifecycle_once_\d+) AS MATERIALIZED \(SELECT ([a-z0-9_.]+\(\)) AS value\)/g))bindings.push([m[1],m[2]]);body=body.slice(cte[0].length);}
 for(const [alias,call] of bindings){body=body.replaceAll(`(SELECT value FROM ${alias})`,call).replace(new RegExp(`\\b${alias}\\b`,'g'),()=>call);}
 return body;
}
test('exactly six already-bound stable functions share inputs; no metadata or timeout changes',()=>{
 const shared=manifest.filter(e=>e.patches.some(p=>p.replacement.includes('v_lifecycle_once_')));
 assert.deepEqual(shared.map(e=>e.signature).sort(),Object.keys(before).sort());
 for(const e of shared){assert.equal(e.metadata.volatility,'s');assert.equal(e.metadata.security_definer,true);assert.deepEqual(e.metadata.config,['search_path=pg_catalog, public']);}
 assert.equal(manifest.length,31);
 assert.equal(source.match(/SET statement_timeout='60s'/g)?.length,1);
 assert.ok(source.includes('pg_advisory_xact_lock'));
 assert.equal(source.match(/IF public.hotel_v2_external_calendar_provider_evolution_is_safe\(\) IS NOT TRUE/g)?.length,3);
});
// Runtime companion supplies installed bodies without exposing plans or tokens.
export function verifyBody(signature,body){
 assert.ok(body.includes('v_lifecycle_once_'),signature+' is not the optimized installed source');
 assert.equal(createHash('sha256').update(undoSharing(body)).digest('hex'),before[signature],signature+' changed a predicate');
}
export const optimizedSignatures=Object.keys(before);
