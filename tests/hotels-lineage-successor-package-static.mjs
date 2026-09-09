// Offline package audit only: never connects to PostgreSQL, Supabase or PostgREST.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(p,'utf8');
const expected=[
  {
    "path": "supabase/migrations/20260811441600_hotels_v2_seven_arches_authorized_lineage_reconciliation.sql",
    "sha256": "cc9eb2f619c4c710ea6dd792a86957a6dba41757cc8c0fced1369082b80a3881",
    "lines": 724
  },
  {
    "path": "supabase/migrations/20260811442000_hotels_v2_seven_arches_application_pricing_bridge.sql",
    "sha256": "7026d08e220887f4f71553c3d7e53384f89b23bbc686ae3bd51a24e7b2aee879",
    "lines": 1299
  },
  {
    "path": "supabase/migrations/20260811442500_hotels_v2_external_calendar_site_settings_compatibility.sql",
    "sha256": "d72c244840bd21a5c5e7e46f654c8b3a7466f80f1d18ebac3ca938ab43163ee5",
    "lines": 306
  },
  {
    "path": "supabase/migrations/20260811445000_hotels_v2_external_calendar_provider_types.sql",
    "sha256": "6151c12a14022e64f6e30421fca6646bc2a540cc111b399b88ac80934174a5d3",
    "lines": 3029
  },
  {
    "path": "supabase/migrations/20260811446000_hotels_v2_partner_stripe_connect.sql",
    "sha256": "1e94ad30e9ebdd4d4ca0318ba30c521f3e7e12af5443557f5dfaf06b9f438d14",
    "lines": 248
  },
  {
    "path": "supabase/migrations/20260811447000_hotels_v2_partner_stripe_onboarding_authorization.sql",
    "sha256": "7eda4c43fcd4374e30221a0c7d3606090a3414ba4f9d2cf27363474bba1875c0",
    "lines": 265
  },
  {
    "path": "supabase/migrations/20260811448000_hotels_v2_audited_capability_lifecycle.sql",
    "sha256": "2bce4cc9d2cef073acce9c416a2b6a5cd681cd24e100c5b1501ee276e3a173fa",
    "lines": 420
  }
];
const manuals=['114416_prewrite','114416_postinstall','114450_successor_postinstall','114480_successor_postinstall']
 .map(s=>'supabase/manual/hotels_v2_'+s+'_readonly.sql');
const migration=read(expected[0].path);
test('all seven tested migration bytes and line counts remain exact',()=>{
 for(const f of expected){const b=fs.readFileSync(f.path);assert.equal(sha(b),f.sha256);assert.equal(b.toString().split('\n').length-1,f.lines);}
});
test('fifteen exact helper body pins are independently recomputed',()=>{
 const functions=[...migration.matchAll(/^CREATE FUNCTION hotels_lineage_private\.([a-z_]+)\(([^\n]*)\)\n(?:(?!^CREATE |^DO )[\s\S])*?AS \$function\$([\s\S]*?)\$function\$;/gm)];
 assert.equal(functions.length,15);
 for(const f of functions)for(const file of manuals.slice(1))assert.ok(read(file).includes(sha(f[3])),f[1]+' '+file);
});
test('read-only wrappers, single final table, no executable mutation or timeout override',()=>{
 for(const f of manuals){
  const s=read(f);
  assert.ok(s.startsWith('BEGIN;\nSET TRANSACTION READ ONLY;\nSET TRANSACTION ISOLATION LEVEL REPEATABLE READ;'));
  assert.ok(s.trimEnd().endsWith('ROLLBACK;'));
  assert.equal([...s.matchAll(/^SELECT /gm)].length,1);
  const code=s.replace(/--[^\n]*/g,'').replace(/'(?:''|[^'])*'/g,"''");
  assert.doesNotMatch(code,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|EXECUTE|LOCK)\b/i);
  assert.doesNotMatch(code,/\b(?:statement_timeout|lock_timeout)\s*=/i);
  assert.doesNotMatch(code,/(?:seal_successor|admin_(?:preview|apply|submit))\s*\(/i);
 }
});
test('successor certificates retain exact stage, manifests and immutable root checks',()=>{
 for(const stage of [114450,114480]){
  const s=read('supabase/manual/hotels_v2_'+stage+'_successor_postinstall_readonly.sql');
  assert.ok(s.includes('successors_are_exact(root_hash) IS NOT TRUE'));
  assert.ok(s.includes('successor_boundary_is_exact('+stage+',true) IS NOT TRUE'));
  assert.ok(s.includes('array_agg(stage ORDER BY stage)'));
  assert.ok(s.includes('current_anchor_is_exact() IS NOT TRUE'));
 }
});
test('prewrite permission evidence uses the accepted body without returning private data',()=>{
 const original=migration.split('CREATE FUNCTION hotels_lineage_private.permission_evidence()')[1].split('AS $function$')[1].split('$function$;')[0];
 // Structural fidelity is checked by pinning its critical exact provenance predicates.
 const pre=read(manuals[0]);
 for(const name of ['after_permission','partner_id','owner_constraint_tokens']) {
  if(original.includes(name))assert.ok(pre.includes(name),name);
 }
 assert.doesNotMatch(pre,/RETURN\s+jsonb_build_object/i);
 assert.ok(pre.includes('current_catalog_jsonb')||!pre.includes('current_catalog'));
 assert.ok(pre.includes('IS DISTINCT FROM ARRAY'));
});
test('tested post-114416 preaction gate remains byte-identical',()=>{
 assert.equal(sha(fs.readFileSync('supabase/manual/hotels_v2_114420_after_lineage_reconciliation_preaction_readonly.sql')),
 '826fe0edd546094beb8b08e964d6517851bb10d07febec9b8df07187139c6c00');
});
test('historical freeze includes legacy migration numbers, not lexical max',()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only','2d7277fba6edf75107b8a8835561dde260ec157c','supabase/migrations'],{encoding:'utf8'}).trim().split('\n');
 const frozen=files.filter(p=>{const v=path.basename(p).split('_')[0];return /^\d{3,4}$/.test(v)||(/^\d{14}$/.test(v)&&v<='20260811441500');});
 assert.equal(frozen.length,235);
 assert.equal(new Set(frozen.map(p=>path.basename(p).split('_')[0])).size,233);
 for(const p of frozen)assert.equal(sha(fs.readFileSync(p)),sha(execFileSync('git',['show','2d7277fba6edf75107b8a8835561dde260ec157c:'+p])));
});
test('authoritative runbook includes exact current hashes and all repair commands',()=>{
 const s=read('docs/hotels-functional-rollout-runbook-20260907.md');
 for(const f of expected){assert.ok(s.includes(f.sha256));assert.ok(s.includes('supabase migration repair '+path.basename(f.path).slice(0,14)+' --status applied --linked'));}
 assert.ok(s.includes('/private/tmp/hotels-lineage-successor-final-manifest.json'));
});
