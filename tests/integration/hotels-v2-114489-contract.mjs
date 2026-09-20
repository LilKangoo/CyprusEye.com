import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,createHmac} from 'node:crypto';
import {build,migrationPath} from './hotels-v2-114489-build.mjs';
import {root,sha,extractEvidence} from './hotels-v2-114489-source-evidence.mjs';
import {focusedCompilerTests,replaceCalls} from './hotels-v2-114489-foundation-compiler.mjs';
import {mask} from './hotels-v2-114488-read-compiler.mjs';
import {candidateSource} from './hotels-v2-114489-candidate-source.mjs';
const read=p=>readFileSync(root+p,'utf8');
const fallback=build(),migration=read(migrationPath),runtime=read('tests/integration/hotels-v2-114489-runtime-template.sql');
test('candidate extractor stays in the exact declaration across inline/newline AS and rejects missing AS',()=>{
 const next="\nCREATE FUNCTION private.next() RETURNS text AS 'wrong';";
 for(const space of [' ','\n'])assert.equal(candidateSource("CREATE FUNCTION private.test() RETURNS text"+space+"AS 'it''s correct';"+next,'private.test'),"it's correct");
 assert.equal(candidateSource('CREATE FUNCTION private.test() RETURNS text AS $body$correct$body$;'+next,'private.test'),'correct');
 assert.throws(()=>candidateSource('CREATE FUNCTION private.test() RETURNS text;'+next,'private.test'),/AS missing/);
});
test('D7 source-pinned private volatile snapshot chain is exact and sealed, without changing public ancestors',()=>{
 const base='hotels_published_architecture_private.workspace_snapshot_external_base_114489';
 const snapshot='hotels_published_architecture_private.workspace_snapshot_114489';
 const workspace='hotels_published_architecture_private.foundation_9caf92b3a8833eba';
 const sources=[candidateSource(migration,base),candidateSource(migration,snapshot),candidateSource(migration,workspace)];
 assert.deepEqual(sources.map(sha),[
  '4835eb7d8d63b6285b4a234c68f047eee698c5e23f3158b2f329cb1098e9d9e3',
  'e4979e39f5deb2d0eb55dd4e83bd942cc7184b6bde18f7f9b196e05154b31926',
  '97cafd6ec02d18221b815b60b3d2e1c5e4982b1ec72956c97bc4f1451974fcb0'
 ]);
 assert.ok(sources[0].includes("architecture_version IN('legacy','rooms_v2')"));
 assert.ok(sources[1].includes(base+'('));
 assert.ok(sources[2].includes(snapshot+'('));
 for(const [i,name] of [base,snapshot].entries()){
  const header=mask(migration).slice(migration.indexOf('CREATE FUNCTION '+name+'(')).split(';')[0];
  assert.match(header,/VOLATILE\s+SECURITY DEFINER\s+SET search_path=pg_catalog,public,auth/);
  assert.ok(sources[i].includes("message='hotels_114489_target_required'"));
  assert.ok(sources[i].includes('hotels_published_architecture_private.assert_exact()'));
  assert.ok(sources[i].includes('hotels_published_architecture_private.require_lifecycle()'));
  assert.ok(migration.indexOf('CREATE FUNCTION '+name+'(')<migration.indexOf('INSERT INTO hotels_published_architecture_private.foundation_certificate'));
  assert.ok(migration.includes(`ALTER FUNCTION ${name}(uuid, date, date, boolean) OWNER TO postgres;`));
  assert.ok(migration.includes(`REVOKE ALL ON FUNCTION ${name}(uuid, date, date, boolean)\n FROM PUBLIC,anon,authenticated,service_role;`));
 }
 assert.doesNotMatch(mask(migration),/CREATE(?: OR REPLACE)? FUNCTION public\.hotel_v2_admin_d_snapshot/);
 assert.ok(read('tests/integration/hotels-v2-114489-foundation-compiler.mjs').includes('mutable ancestor requires separately reviewed writer compiler'));
});
test('SQL source bodies have balanced lexical delimiters (not a PostgreSQL execution claim)',()=>{
 const sources=[migration,...[...migration.matchAll(/\bAS\s+(?:\$(\w*)\$([\s\S]*?)\$\1\$|'((?:''|[^'])*)')/gi)].map(m=>m[2]??m[3].replaceAll("''","'"))];
 for(const source of sources){
  const stack=[];
  for(const ch of mask(source)){
   if(ch==='('||ch==='[')stack.push(ch);
   if(ch===')'||ch===']')assert.equal(stack.pop(),ch===')'?'(':'[',source.slice(0,100));
  }
  assert.equal(stack.length,0,source.slice(0,100));
 }
});
test('32-byte private-key HMAC construction matches Node RFC2104 implementation',()=>{
 const key=Buffer.alloc(32,0x17),message=Buffer.from('a'.repeat(64));
 const inner=Buffer.alloc(64,0x36),outer=Buffer.alloc(64,0x5c);
 for(let i=0;i<32;i++){inner[i]^=key[i];outer[i]^=key[i];}
 const hash=b=>createHash('sha256').update(b).digest();
 assert.equal(hash(Buffer.concat([outer,hash(Buffer.concat([inner,message]))])).toString('hex'),createHmac('sha256',key).update(message).digest('hex'));
});
test('source-only generation uses exact repo evidence and fails closed if the overlay is unavailable',()=>{
 assert.deepEqual(fallback.unresolved,[]);
 assert.deepEqual(fallback.missingBodies,[]);
 assert.equal(sha(fallback.migration),'9e0b6d39bbeebcba0d386aca87ff8418ea8682763f9c5cfad964ef41c246af14');
 assert.throws(()=>build({evidenceOptions:{path:new URL('./fixtures/114489-overlay-not-present.json',import.meta.url)}}),/ENOENT/);
 assert.match(fallback.migration,/^BEGIN;$/m);
 assert.match(fallback.migration,/COMMIT;\s*$/);
});
test('resolved repository artifact is transaction-bounded and contains no accepted-catalog hard stop',()=>{
 assert.equal(migration,fallback.migration);
 assert.match(migration,/^BEGIN;$/m);
 assert.match(migration,/SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;/);
 assert.match(migration,/COMMIT;\s*$/);
 assert.match(migration,/^-- Unresolved compiler evidence: none\.$/m);
 assert.doesNotMatch(
  migration,
  /hotels_114489_pending_accepted_foundation_catalog|ACCEPTED_114488_FOUNDATION_CATALOG/
 );
 // Runtime approval markers remain until the local PostgreSQL gate succeeds.
 assert.match(migration,/LOCAL SOURCE WIP/);
 assert.match(migration,/POSTGRES_RUNTIME_TESTS=PENDING_ENVIRONMENT/);
 assert.match(migration,/NOT APPROVED FOR INSTALLATION/);
});
test('resolved writer boundary recognizes exact 114350 external-calendar compatibility evolution',()=>{
 const compatibility=read('supabase/migrations/20260811435000_hotels_v2_external_calendar_activation_compatibility.sql');
 assert.ok(
  compatibility.includes(
   "('public.hotel_v2_admin_apply_property_control_plan(jsonb,uuid)',"
  )
 );
 assert.ok(
  compatibility.includes(
   "'hotel_rooms_v2_enabled or hotel_external_sync_enabled','hotel_rooms_v2_enabled or false',1"
  )
 );
 const boundary=migration.slice(
  0,
  migration.indexOf('END $boundary$;')
 );
 assert.ok(
  boundary.includes(
   "IS DISTINCT FROM 'e7b3f50952b25e596c662519fca4e02f9dff128ffd707533faf1664e3867752c'"
  )
 );
 assert.ok(
  boundary.includes(
   "IS DISTINCT FROM 'd1d166b0662601f466c517014f641c4555c563f9fb71e0c0dd2b2de43fbb869b'"
  )
 );
});

test('historical migration freeze 114484 through 114488',()=>{
 const files=readdirSync(root+'supabase/migrations').filter(p=>/^20260811448[4-8]00_/.test(p));
 assert.equal(files.length,5);
 for(const p of files)assert.equal(sha(read('supabase/migrations/'+p)),sha(execFileSync('git',['show','HEAD:supabase/migrations/'+p],{cwd:root})),p);
});
test('all six required versioned public RPC source declarations exist, no historical replacement',()=>{
 for(const name of ['hotel_v2_admin_get_published_architecture_conversion_114489','hotel_v2_admin_convert_legacy_hotel_to_v2_114489',
 'hotel_v2_admin_apply_property_control_plan_114489','hotel_v2_admin_apply_partner_property_proposal_plan_114489',
 'hotel_v2_partner_get_workspace_114489','hotel_v2_public_get_seven_arches_display_114489'])
  assert.match(migration,new RegExp('CREATE FUNCTION public\\.'+name+'\\(','i'));
 assert.doesNotMatch(mask(migration),/CREATE OR REPLACE FUNCTION public\./i);
});
test('only exact published target receives successor constraint; no unpublish or public-booking transition',()=>{
 assert.match(migration,/id='9b6d99a0-923a-4fbc-be54-c066e856e6ca' AND architecture_version='rooms_v2' AND is_published=true/);
 assert.doesNotMatch(mask(runtime),/SET\s+is_published\s*=|UPDATE\s+public\.site_settings|UPDATE\s+.*stripe/i);
 assert.match(runtime,/SET architecture_version='rooms_v2',updated_at=clock_timestamp\(\)/);
 assert.match(runtime,/before_hotel-ARRAY\['architecture_version','updated_at'\] IS DISTINCT FROM after_hotel/);
});
test('conversion plan is actor-bound, signed, expiry-bound, snapshot-bound and exact-key checked',()=>{
 for(const term of ['sign_plan(p_plan)','actor::text','jsonb_object_keys(p_plan)','hotels_114489_plan_expired',
 'hotels_114489_stale_snapshot','pg_advisory_xact_lock','hotels_114489_already_converted'])assert.ok(runtime.includes(term),term);
 assert.ok(runtime.indexOf('hotels_114489_invalid_plan')<runtime.indexOf('UPDATE public.hotels'));
 assert.ok(runtime.indexOf('hotels_114489_stale_snapshot')<runtime.indexOf('UPDATE public.hotels'));
 assert.ok(runtime.includes("r.id=p_request_id AND r.actor_id=actor AND r.expected_state_hash=p_plan->>'snapshot_hash'"));
});
test('private HMAC key and immutable receipts have no browser/service grants',()=>{
 assert.ok(runtime.includes("decode(repeat('36',64),'hex')"));assert.ok(runtime.includes("decode(repeat('5c',64),'hex')"));
  assert.ok(runtime.includes(
   "digest(public.hotel_v2_seven_arches_pricing_activation_canonical_json(p_plan-'signature'))"
  ));
  assert.ok(!runtime.includes(
   "pricing_activation_plan_fingerprint(p_plan-'signature')"
  ));
  assert.ok(runtime.includes("p_plan->>'signature' IS NULL"));
  assert.ok(runtime.includes("p_plan->>'signature' !~ '^[0-9a-f]{64}$'"));
  assert.ok(runtime.includes(
   "r.reviewed_plan_signature:=p_plan->>'signature'"
  ));
  assert.ok(runtime.includes(
   "r.reviewed_plan_signature=p_plan->>'signature'"
  ));
 for(const table of ['plan_key','property_history','conversion_receipt'])assert.match(migration,new RegExp('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE OR TRUNCATE[\\s\\S]{0,100}'+table));
 assert.ok(migration.includes('ENABLE ROW LEVEL SECURITY'));assert.ok(migration.includes('FORCE ROW LEVEL SECURITY'));
 assert.ok(migration.includes('FROM PUBLIC,anon,authenticated,service_role'));
});
test('property and proposal successor retain reviewed-plan machinery, and only target routes change',()=>{
 for(const s of ['hotels_v2_admin_b_stale_property_during_apply','hotels_v2_admin_b_correlation_id_already_used',
 'hotels_v2_seven_arches_property_proposal_review_expired','v_review.reviewed_plan is distinct from p_reviewed_plan',
 'hotels_v2_seven_arches_property_proposal_context_cleanup_failed'])assert.ok(migration.includes(s));
 const repo=read('admin/hotels-v2-workspace-repository.js');
 assert.ok(repo.includes('plan.hotel_id === PUBLISHED_CONVERSION_HOTEL ? RPC.applyPartnerPropertyProposalPlan114489 : RPC.applyPartnerPropertyProposalPlan'));
 assert.ok(repo.includes('id === PUBLISHED_CONVERSION_HOTEL ? RPC.applyPropertyControl114489 : RPC.applyPropertyControl'));
});
test('public DTO keeps bed quantity/count mapping and no private account/authorization fields',()=>{
 const template=read('tests/integration/hotels-v2-114489-conversion-template.sql');
 const publicRead=template.slice(template.indexOf('CREATE FUNCTION public.hotel_v2_public'));
 assert.match(publicRead,/'count',b\.v->'quantity'/);
 assert.ok(publicRead.includes("'display_only',true"));assert.ok(publicRead.includes("'public_booking_enabled',false"));
 assert.doesNotMatch(mask(publicRead),/INSERT|UPDATE|DELETE|set_config|pg_advisory/i);
});
test('historical projection is internal, audit chained, and never rewrites public DTOs',()=>{
 const projection=read('tests/integration/hotels-v2-114489-projection.mjs');
 for(const s of ['hotels_114489_property_audit_invalid','hotels_114489_unreviewed_property_change','hotels_114489_projection_receipt_drift'])assert.ok(projection.includes(s));
 assert.ok(projection.includes("RETURN anchor||jsonb_build_object('pricing_tiers',p_hotel->'pricing_tiers')"));
 const entry=read('tests/integration/hotels-v2-114489-entrypoints-template.sql');
 assert.ok(entry.includes("result#>>'{property,architecture_version}' IS DISTINCT FROM evidence->>'architecture_version'"));
});
test('foundation focused 8 checks and no literal/comment rewriting',()=>{
 assert.deepEqual(focusedCompilerTests(),{source_span_tests:4,historical_contract_static_tests:4,pass:true});
 assert.equal(replaceCalls("SELECT 'public.x()'; -- public.x()\n SELECT public.x();",[['public.x','private.y']]).patches.length,1);
});
test('all recovered offline source bodies match their own prosrc pins, never catalog-hash substitution',()=>{
 const e=extractEvidence();assert.ok(e.catalog.length>100);
 for(const p of e.catalog)assert.equal(sha(p.src),p.meta[0],p.name);
 assert.deepEqual(e.missing,[],'all missing sources must be filled by the exact pinned overlay');
});
test('Admin UI is read-first and separately confirmed; generic readiness does not authorize the target',()=>{
 const ui=read('admin/hotels-v2-workspace.js');
 assert.ok(ui.includes("property.id === '9b6d99a0-923a-4fbc-be54-c066e856e6ca' ? renderPublishedConversionCard() : renderReadinessCard(readiness)"));
 assert.ok(ui.includes('data-conversion-apply hidden'));
 assert.ok(ui.includes("confirmation !== 'CONVERT 7 KAMARES TO ROOMS_V2'"));
 assert.ok(ui.includes('const plan = reviewed; reviewed = null; apply.disabled = true;'));
});

test('resolved artifact has complete private foundation helper closure',()=>{
 const definitions=new Set(
  [...migration.matchAll(
   /CREATE FUNCTION\s+hotels_published_architecture_private\.(foundation_[0-9a-f]{16})\s*\(/gi
  )].map(m=>m[1])
 );
 const references=new Set(
  [...migration.matchAll(
   /hotels_published_architecture_private\.(foundation_[0-9a-f]{16})\s*\(/gi
  )].map(m=>m[1])
 );
 const dangling=[...references]
  .filter(name=>!definitions.has(name))
  .sort();

 assert.deepEqual(dangling,[]);
});
