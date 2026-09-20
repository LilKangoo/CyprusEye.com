import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractMigrationEvidence,extractEvidence,sha,root} from './hotels-v2-114489-source-evidence.mjs';
import {fillSourceOverlay,overlayPath,overlayPins,signature} from './hotels-v2-114489-source-overlay.mjs';
import {completeRepoDeclarations} from './hotels-v2-114489-repo-declarations.mjs';
import {build,migrationPath} from './hotels-v2-114489-build.mjs';
import {compile,evidenceRoots,focusedCompilerTests} from './hotels-v2-114489-foundation-compiler.mjs';
const raw=extractMigrationEvidence(),overlay=JSON.parse(readFileSync(overlayPath,'utf8'));
const expected='9e0b6d39bbeebcba0d386aca87ff8418ea8682763f9c5cfad964ef41c246af14';
const fill=data=>fillSourceOverlay(raw,{overlay:data});
test('exact 127 repo rows / 15 missing / 15 unique accepted pins',()=>{
 assert.equal(raw.catalog.length,127);assert.equal(raw.missing.length,15);
 assert.equal(overlay.rows.length,15);assert.equal(new Set(overlay.rows.map(signature)).size,15);
 assert.deepEqual(raw.missing.map(s=>s.replace(/\s/g,'')).sort(),overlayPins.map(p=>p.signature).sort());
 for(const p of overlayPins)assert.equal(sha(overlay.rows.find(r=>signature(r)===p.signature).src),p.source_sha256);
 assert.equal(overlayPins[1].source_sha256,'9798b885198ee02fc8b7154ce67d2caba98b885268ae29a8f486894032657084');
 assert.equal(fill(overlay).catalog.length,142);assert.deepEqual(fill(overlay).missing,[]);
});
test('OVERLAY_MISSING_TEST',()=>assert.throws(()=>fillSourceOverlay(raw,{path:new URL('./fixtures/not-present-114489.json',import.meta.url)}),/ENOENT/));
for(const [name,change,error] of [
 ['ROW_REMOVED',v=>v.rows.pop(),/exactly 15/],
 ['EXTRA_ROW',v=>v.rows.push(structuredClone(v.rows[0])),/exactly 15/],
 ['DUPLICATE',v=>v.rows[1]=structuredClone(v.rows[0]),/duplicate overlay/],
 ['SOURCE_TAMPER',v=>v.rows[0].src+=' ',/source drift/],
 ['TYPES_TAMPER',v=>v.rows[0].types='uuid',/unexpected overlay signature/],
 ['VOLATILITY_TAMPER',v=>v.rows[0].vol='v',/exact metadata drift/],
 ['LANGUAGE_TAMPER',v=>v.rows[0].lang='sql',/exact metadata drift/],
 ['ACL_TAMPER',v=>v.rows[0].meta[3]='{postgres=X/postgres,anon=X/postgres}',/exact metadata drift/],
 ['OWNER_TAMPER',v=>v.rows[0].meta[2]='authenticated',/exact metadata drift/],
 ['CONFIG_TAMPER',v=>v.rows[0].meta[4]=['search_path=public'],/exact metadata drift/],
 ['RETURN_TAMPER',v=>v.rows[0].ret='text',/exact metadata drift/],
 ['ARGS_TAMPER',v=>v.rows[0].args='p_value uuid',/exact metadata drift/],
 ['DEFINITION_TAMPER',v=>v.rows[0].def+=' ',/exact metadata drift/],
 ['CATALOG_PROVENANCE_TAMPER',v=>v.catalog_sha256='0'.repeat(64),/AssertionError/],
 ['UNKNOWN_FIELD',v=>v.rows[0].unexpected=true,/exact metadata drift/],
])test('OVERLAY_'+name+'_TEST',()=>{
 const data=structuredClone(overlay);change(data);assert.throws(()=>fill(data),error);
});
test('OVERLAY_REPO_CONFLICT_TEST',()=>{
 const row=overlay.rows[0];
 for(const src of [row.src,row.src+' '])assert.throws(()=>fillSourceOverlay({...raw,catalog:[...raw.catalog,{...row,src}]},{overlay}),/cannot override repo source/);
 for(const src of [row.src,row.src+' '])assert.throws(()=>fillSourceOverlay({...raw,bodies:new Map([...raw.bodies,[row.meta[0],src]])},{overlay}),/cannot override recovered body/);
 const records=structuredClone(raw.records);records.get([...records.keys()].find(k=>k.replace(/\s/g,'')===signature(row))).meta[5]='v';
 assert.throws(()=>fillSourceOverlay({...raw,records},{overlay}),/conflicts with repository metadata/);
 const argumentRecords=structuredClone(raw.records);
 argumentRecords.get([...argumentRecords.keys()].find(k=>k.replace(/\s/g,'')===signature(row))).meta[12]='uuid';
 assert.throws(()=>fillSourceOverlay({...raw,records:argumentRecords},{overlay}),/type metadata conflict/);
});
test('five additional declarations are repo-derived, not extra overlay bodies',()=>{
 const e=completeRepoDeclarations(fill(overlay));assert.equal(e.catalog.length,147);assert.deepEqual(e.missing,[]);
 for(const p of e.catalog)assert.equal(sha(p.src),p.meta[0]);
 for(const p of e.catalog.filter(p=>!fill(overlay).catalog.some(r=>signature(r)===signature(p)))){
  assert.equal(sha(p.def),p.meta[1]);assert.ok(raw.bodies.has(p.meta[0]),p.name);
 }
});
test('OVERLAY_REORDER_DETERMINISM_TEST and repository build are byte-identical',()=>{
 const reversed=structuredClone(overlay);reversed.rows.reverse();
 const a=build(),b=build({evidenceOptions:{overlay:reversed}});
 assert.equal(a.migration,b.migration);assert.equal(sha(a.migration),expected);
 assert.equal(a.migration,readFileSync(root+migrationPath,'utf8'));
 assert.deepEqual(a.unresolved,[]);assert.deepEqual(a.missingBodies,[]);
});
test('foundation source-span tests and VOLATILE guard remain active',()=>{
 assert.deepEqual(focusedCompilerTests(),{source_span_tests:4,historical_contract_static_tests:4,pass:true});
 const all=extractEvidence().catalog;
 all.find(p=>p.name==='public.hotel_v2_partner_get_workspace').vol='v';
 assert.throws(()=>compile(all,{roots:[...evidenceRoots,'public.hotel_v2_partner_get_workspace'],forceCloneRoots:['public.hotel_v2_partner_get_workspace']}),/mutable ancestor requires separately reviewed writer compiler/);
});
